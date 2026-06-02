"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, next) {
    res.status(err.status || 500).json({
        error: err.message || "Erro interno do servidor"
    });
}
//# sourceMappingURL=error.middleware.js.map