namespace Config {
    namespace Fields {
        type Base = 'timestamp' | 'data';
        type Extra = 'level' | 'file' | 'function' | 'lineNumber' | 'id' | 'serverIp' | 'context' | 'category';
        type All = Base | Extra;
    }
    
    type Options = {
        directory?: string,
        fileName?: string,
        enableRotation?: boolean,
        shortFieldNames?: boolean,
        extraLogFields?: Fields.Extra[],
        rotationOptions?: RotationOptions
    }

    type RotationOptions = {
        type?: RotationType,
        backupCount?: number,
        maxFileSize?: RotationFileSize,
        frequency?: RotationFrequency,
        archiveBackups?: boolean
    }

    type RotationType = 'size' | 'time';

    type RotationFileSize = number | `${number}${'K' | 'M' | 'G'}`

    type RotationFrequency = 'monthly' | 'daily' | 'hourly'
}