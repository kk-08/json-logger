module.exports = {

    /**
     * Returns the value as-is if it is a non-empty object. Returns an empty object otherwise
     * @param {*} value 
     * @returns {object}
     */
    sanitizeObject(value) {
        if (!this.isNonEmptyObject(value)) value = {};
        return value;
    },

    /**
     * Returns `true` if the received parameter is a valid and non-empty object
     * @param {*} value 
     */
    isNonEmptyObject(value) {
        return Boolean(typeof value === 'object' && Object.keys(value).length);
    },

    /**
     * Returns the project root directory
     * @param {*} value 
     */
    getProjectRoot() {
        return __dirname.split('/node_modules')[0];
    },

    /**
     * Returns `true` if the received parameter is a valid and non-empty array
     * @param {*} value 
     */
    isNonEmptyArray(value) {
        return Boolean(Array.isArray(value) && value.length);
    },
}