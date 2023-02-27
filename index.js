const fs = require('fs');
const path = require('path');
const serverIp = require('ip').address();
const log4js = require('log4js');
const moment = require('moment');
const utils = require('./utils');


const DEFAULT_LOGGER_CATEGORY = 'app';

const DIRECT_CONFIG_UPDATES = {
    directory: true,
    fileName: true,
    enableRotation: true,
    shortFieldNames: true,
};

const LOG_FIELDS = {
    TIMESTAMP: { name: 'timestamp', default: true },
    DATA: { name: 'data', default: true },
    LEVEL: { name: 'level', default: false },
    FILE: { name: 'file', default: false },
    FUNCTION: { name: 'function', default: false },
    LINE_NUMBER: { name: 'lineNumber', default: false },
    ID: { name: 'id', default: false },
    SERVER_IP: { name: 'serverIp', default: false },
    CONTEXT: { name: 'context', default: false },
    CATEGORY: { name: 'category', default: false }
}

const FIELD_SHORT_NAMES = {
    [LOG_FIELDS.TIMESTAMP.name]: 'ts',
    [LOG_FIELDS.DATA.name]: 'dt',
    [LOG_FIELDS.LEVEL.name]: 'lvl',
    [LOG_FIELDS.FILE.name]: 'fl',
    [LOG_FIELDS.FUNCTION.name]: 'fn',
    [LOG_FIELDS.LINE_NUMBER.name]: 'ln',
    [LOG_FIELDS.ID.name]: 'id',
    [LOG_FIELDS.SERVER_IP.name]: 'sIp',
    [LOG_FIELDS.CONTEXT.name]: 'ctx',
    [LOG_FIELDS.CATEGORY.name]: 'cat'
}

/**
 * @type {Set<Config.Fields.Extra>}
 */
const ALLOWED_FIELD_UPDATES = new Set([
    LOG_FIELDS.LEVEL.name, 
    LOG_FIELDS.FILE.name, 
    LOG_FIELDS.FUNCTION.name, 
    LOG_FIELDS.LINE_NUMBER.name, 
    LOG_FIELDS.ID.name, 
    LOG_FIELDS.SERVER_IP.name, 
    LOG_FIELDS.CONTEXT.name, 
    LOG_FIELDS.CATEGORY.name
]);


class Logger {
    #config = { default: {}, loggers: {} };

    static ROTATION_TYPES = {
        SIZE: 'size',
        TIME: 'time',
    }

    static #APPENDER_TYPES = {
        FILE: 'file',
        DATE_FILE: 'dateFile',
    }

    static #ROTATION_TYPES_MAP = {
        [Logger.ROTATION_TYPES.SIZE]: Logger.#APPENDER_TYPES.FILE,
        [Logger.ROTATION_TYPES.TIME]: Logger.#APPENDER_TYPES.DATE_FILE,
    }

    static TIME_ROTATION_FREQUENCIES = {
        MONTHLY: 'monthly',
        DAILY: 'daily',
        HOURLY: 'hourly',
    }

    static #FREQUENCY_PATTERN_MAP = {
        [Logger.TIME_ROTATION_FREQUENCIES.MONTHLY]: 'MM-yyyy',
        [Logger.TIME_ROTATION_FREQUENCIES.DAILY]: 'dd-MM-yyyy',
        [Logger.TIME_ROTATION_FREQUENCIES.HOURLY]: 'dd-MM-yyyy-hh',
    }

    static #APPENDER_TYPE_OPTIONS = {
        [Logger.#APPENDER_TYPES.FILE]: ['backups', 'maxLogSize'],
        [Logger.#APPENDER_TYPES.DATE_FILE]: ['numBackups', 'pattern', 'alwaysIncludePattern'],
    }

    static #DEFAULT_ROTATION_SETTINGS = {
        type: Logger.#APPENDER_TYPES.DATE_FILE,
        pattern: Logger.#FREQUENCY_PATTERN_MAP[Logger.TIME_ROTATION_FREQUENCIES.DAILY],
        alwaysIncludePattern: true,
        numBackups: 90,
        backups: 90,
        maxLogSize: '10M'
    }

    /**
     * @param {Config.Options} [options={}] 
     */
    constructor(options = {}) {
        options = utils.sanitizeObject(options);
        this.#initDefaultConfig();
        Logger.#updateConfig(this.#config.default, options);
    }

    /**
     * Initializes the default config
     */
    #initDefaultConfig() {
        this.#config.default = {
            directory: utils.getProjectRoot(),
            fileName: DEFAULT_LOGGER_CATEGORY,
            layout: {},
            enableRotation: false,
            shortFieldNames: false,
            rotationOptions: {
                type: Logger.#DEFAULT_ROTATION_SETTINGS.type,
                pattern: Logger.#DEFAULT_ROTATION_SETTINGS.pattern,
                numBackups: Logger.#DEFAULT_ROTATION_SETTINGS.numBackups,
                keepFileExt: true,
                compress: false,
                alwaysIncludePattern: true,
                fileNameSep: '-'
            },
        }
        Logger.#resetLogFieldsConfig(this.#config.default);
    }

    /**
     * Resets log fields to default configuration in the passed `config`
     * @param {object} config 
     */
    static #resetLogFieldsConfig(config) {
        for (const field of Object.values(LOG_FIELDS)) {
            config.layout[field.name] = field.default;
        }
    }

    /**
     * Updates the `config` passed with the given `options`, if any
     * @param {object} config 
     * @param {Config.Options} [options={}]
     */
    static #updateConfig(config, options = {}) {
        for (const [key, value] of Object.entries(options)) {
            Logger.#updateFieldInObject(config, DIRECT_CONFIG_UPDATES, key, value);
        }

        if (utils.isNonEmptyArray(options.extraLogFields)) Logger.#updateLogFieldsConfig(config, options.extraLogFields);
        if (config.enableRotation) Logger.#updateRotationConfig(config, options.rotationOptions);
    }

    /**
     * Updates the value of the given `field` in the `object` if allowed (basis `allowed_updates`).
     * Works recursively if `data` is an object
     * @param {object} object 
     * @param {object} allowed_updates 
     * @param {string} field 
     * @param {*} data 
     * @returns 
     */
    static #updateFieldInObject(object, allowed_updates, field, data) {
        if (!allowed_updates[field]) return;

        if (typeof data === 'object') {
            for (const [key, value] of Object.entries(data)) {
                Logger.#updateFieldInObject(object[field], allowed_updates[field], key, value);
            }
        } else {
            object[field] = data;
        }
    }

    /**
     * Configures the log layout with the required `logFields` in the `config` to be used for the JSON log
     * @param {object} config 
     * @param {Config.Fields.Extra[]} logFields 
     */
    static #updateLogFieldsConfig(config, logFields) {
        Logger.#resetLogFieldsConfig(config);
        for (const field of logFields) {
            if (ALLOWED_FIELD_UPDATES.has(field)) config.layout[field] = true;
        }
    }

    /**
     * Updates the `config` passed with the given `options` for log rotation
     * Adds
     * @param {object} config 
     * @param {Config.RotationOptions} [options={}] 
     */
    static #updateRotationConfig(config, options = {}) {
        const type = Logger.#ROTATION_TYPES_MAP[options.type];
        if (type) config.rotationOptions.type = type;
        switch (config.rotationOptions.type) {
            case Logger.#APPENDER_TYPES.FILE:
                Logger.#updateFileTypeConfig(config, options);
                break;
            case Logger.#APPENDER_TYPES.DATE_FILE:
                Logger.#updateDateFileTypeConfig(config, options);
                break;
            default:
                throw new Error('Invalid type found for logger configuration!');
        }

        if (options.archiveBackups) config.rotationOptions.compress = true;
    }

    /**
     * Updates the rotation `config` to allow `size-based` rotation basis the passed `options`
     * @param {object} config 
     * @param {Config.RotationOptions} options 
     */
    static #updateFileTypeConfig(config, options) {
        Logger.#resetRotationOptionsConfig(config, Logger.#APPENDER_TYPES.FILE);
        if (options.backupCount) config.rotationOptions.backups = Number(options.backupCount);
        if (options.maxFileSize) {
            if (Logger.isValidFileSize(options.maxFileSize)) config.rotationOptions.maxLogSize = options.maxFileSize;
            else throw new Error('maxFileSize must be a valid log file size. Expected: number (in case of size in bytes) or number suffixed with K/M/G for kilo/mega/giga bytes');
        }
    }

    /**
     * Returns `true` if the `fileSize` passed is valid
     * @param {*} fileSize 
     * @returns 
     */
    static isValidFileSize(fileSize) {
        return ((typeof fileSize == 'string' && /^[1-9]+[0-9]*[KMG]$/.test(fileSize))
            || typeof fileSize == 'number');
    }

    /**
     * Updates the rotation `config` to allow `time-based` rotation basis the passed `options`
     * @param {object} config 
     * @param {Config.RotationOptions} options 
     */
    static #updateDateFileTypeConfig(config, options) {
        Logger.#resetRotationOptionsConfig(config, Logger.#APPENDER_TYPES.DATE_FILE);
        if (options.backupCount) config.rotationOptions.numBackups = Number(options.backupCount);
        if (options.frequency) {
            if (Logger.#FREQUENCY_PATTERN_MAP[options.frequency]) config.rotationOptions.pattern = Logger.#FREQUENCY_PATTERN_MAP[options.frequency];
            else throw new Error('frequency must be valid. Expected: monthly/daily/hourly');
        }
    }

    /**
     * Updates the rotation `config` to allow `time-based` rotation basis the passed `options`
     * @param {object} config 
     * @param {Internal.Appenders.Type} selectedAppenderType 
     */
    static #resetRotationOptionsConfig(config, selectedAppenderType) {
        //Add defaults of the selected appender type
        const selectedAppenderOptions = Logger.#APPENDER_TYPE_OPTIONS[selectedAppenderType]
        for (const option of selectedAppenderOptions) {
            config.rotationOptions[option] = Logger.#DEFAULT_ROTATION_SETTINGS.maxLogSize
        }

        //Remove values for opposite appender type
        const oppositeAppenderType = selectedAppenderType === Logger.#APPENDER_TYPES.DATE_FILE ? 
            Logger.#APPENDER_TYPES.FILE : Logger.#APPENDER_TYPES.DATE_FILE;
        const options = Logger.#APPENDER_TYPE_OPTIONS[oppositeAppenderType]
        for (const option of options) {
            delete config.rotationOptions[option];
        }
    }

    /**
     * Initializes logger for the passed `category` (if not already configured) 
     * with the default config or overriden config (with `overrideOptions`)
     * @param {string} category 
     * @param {Config.Options} [overrideOptions={}]
     */
    initLogger(category = DEFAULT_LOGGER_CATEGORY, overrideOptions = {}) {
        if (this.#config.loggers[category]) throw new Error(`Logger already initialized for the category: ${category}`);

        overrideOptions = utils.sanitizeObject(overrideOptions);
        this.#updateCustomConfig(category, overrideOptions);
        const logLayout = this.#getLogLayoutConfig();
        log4js.addLayout(category, logLayout);
    }

    /**
     * Updates the default config for the passed `category` if `overrideOptions` are passed.
     * Uses default config if no `overrideOptions` are passed
     * @param {string} category 
     * @param {Config.Options} [overrideOptions={}]
     */
    #updateCustomConfig(category, overrideOptions) {
        if (!utils.isNonEmptyObject(overrideOptions)) {
            this.#config.loggers[category] = false; //Placeholder to use default config
        } else {
            //Create a copy of default config
            this.#config.loggers[category] = JSON.parse(JSON.stringify(this.#config.default));
            Logger.#updateConfig(this.#config.loggers[category], overrideOptions);
        }
    }

    /**
     * Returns the layout function to be used for setting the JSON log layout
     */
    #getLogLayoutConfig() {
        return function (options) {
            return function (logEvent) {
                let layout = {};

                for (const field in options.config.layout) {
                    if (options.config.layout[field]) {
                        let layoutField = options.config.shortFieldNames ? FIELD_SHORT_NAMES[field] : field;
                        switch (field) {
                            case LOG_FIELDS.TIMESTAMP.name:
                                layout[layoutField] = moment(logEvent.startTime).format('YYYY-MM-DD HH:mm:ss.SSS');
                                break;
                            case LOG_FIELDS.LEVEL.name:
                                layout[layoutField] = logEvent.level.levelStr;
                                break;
                            case LOG_FIELDS.CATEGORY.name:
                                layout[layoutField] = logEvent.categoryName;
                                break;
                            case LOG_FIELDS.SERVER_IP.name:
                                layout[layoutField] = serverIp;
                                break;
                            case LOG_FIELDS.FILE.name:
                                layout[layoutField] = path.basename(logEvent.fileName);
                                break;
                            case LOG_FIELDS.FUNCTION.name:
                                layout[layoutField] = logEvent.functionName;
                                break;
                            case LOG_FIELDS.LINE_NUMBER.name:
                                layout[layoutField] = logEvent.lineNumber;
                                break;
                            default:
                                let value = logEvent.data[0][field];
                                if (typeof value === 'object') value = JSON.stringify(value);
                                layout[layoutField] = value;
                                break;
                        }
                    }
                }
                return JSON.stringify(layout);
            }
        }
    }

    /**
     * @summary Returns the logger instance with all the initialized categories
     * 
     * @description The following code returns logger with 2 properties - `app` and `http` - one for each initialized category
     * ```
     * initLogger('app');
     * initLogger('http');
     * const logger = getLoggers();
     * ```
     */
    getLoggers() {
        const categories = Object.keys(this.#config.loggers);
        if (!categories.length) throw new Error('Logger must be initialized for atleast 1 category');

        const loggerConfig = this.#getLog4JsConfiguration(categories);
        log4js.configure(loggerConfig);

        let result = {};
        for (const category of categories) {
            result[category] = log4js.getLogger(category);
        }
        return result;
    }

    /**
     * Generates and returns the configuration required for instantiating log4js
     * @param {string[]} categories 
     * @returns 
     */
    #getLog4JsConfiguration(categories) {
        let config = {
            appenders: {},
            disableClustering: true,
            categories: {}
        };

        for (const category of categories) {
            const appender = this.#getLogAppender(category);
            config.appenders[category] = appender;
            config.categories[category] = { appenders: [category], level: 'all', enableCallStack: true };
            if (!config.categories.default) {
                config.categories.default = { appenders: [category], level: 'all', enableCallStack: true };
            }
        }

        return config;
    }

    /**
     * Generates and returns the appender configuration for the given `category` for instantiating log4js
     * @param {string[]} categories 
     * @returns 
     */
    #getLogAppender(category) {
        const config = this.#config.loggers[category] || this.#config.default;
        if (!fs.existsSync(config.directory)) throw new Error(`Specified directory '${config.directory}' does not exist!`);
        let appender = {
            type: config.rotationOptions.type,
            filename: `${config.directory}/${config.fileName}.log`,
            layout: { type: category, config }
        };

        if (config.enableRotation) {
            for (const [option, value] of Object.entries(config.rotationOptions)) {
                appender[option] = value;
            }
        }

        return appender;
    }
}

module.exports = Logger;