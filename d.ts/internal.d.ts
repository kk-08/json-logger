namespace Internal {
    type Config = {
        directory: string,
        fileName: string,
        layout: Layout,
        enableRotation: boolean,
        shortFieldNames: boolean,
        rotationOptions: {
            type: AppenderType,
            pattern: DatePattern,
            numBackups: number,
            keepFileExt: boolean,
            compress: boolean,
            alwaysIncludePattern: boolean,
            fileNameSep: string,
            backups?: number,
            maxLogSize?: Logger.RotationFileSize
        },
    }

    type Layout = Object<Logger.Fields.All, boolean>

    type AppenderType = 'file' | 'dateFile';

    type DatePattern = 'MM-yyyy' | 'dd-MM-yyyy' | 'dd-MM-yyyy-hh';
}