const Logger = require('./index');

/**
 * Basic configuration to be used for all categories of logger, unless changed
 */
const BASE_LOGGER_CONFIG = {
    directory: `${__dirname}/logs`,
    fileName: 'base',
    enableRotation: true,
    extraLogFields: ['level', 'file', 'function', 'lineNumber', 'serverIp', 'category'],
    rotationOptions: {
        type: 'time',
        backupCount: 2,
        frequency: 'hourly',
        archiveBackups: true
    }
};

/**
 * Additional configuration to be used for http category logger
 */
const HTTP_LOGGER_CONFIG = {
    fileName: 'http',
    enableRotation: true,
    extraLogFields: ['serverIp'],
    rotationOptions: {
        type: 'size',
        backupCount: 2,
        maxFileSize: 10
    }
};

//Initilalize loggers for required categories
const _logger = new Logger(BASE_LOGGER_CONFIG);
_logger.initLogger('app');
_logger.initLogger('http', HTTP_LOGGER_CONFIG);
_logger.initLogger('app');

// Get logger instance and start using it
const logger = _logger.getLoggers();

function doSomething() {
    logger.http.info({ data: 'GET request sent to https://example.com/clients/123' });
    logger.app.debug({ data: { key: "value" }, id: 123456789 });
}

doSomething();