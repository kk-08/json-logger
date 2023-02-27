const Logger = require('./index');

const _logger = new Logger({
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
});

_logger.initLogger('http', {
    fileName: 'http',
    enableRotation: true,
    extraLogFields: ['serverIp'],
    rotationOptions: {
        type: 'size',
        backupCount: 2,
        maxFileSize: 10
    }
});
_logger.initLogger('app');
const logger = _logger.getLoggers();

logger.curl.info({ data: 'test' })
logger.app.debug({ data: { key: "value" }, id: 'someId2', key: 'value'});