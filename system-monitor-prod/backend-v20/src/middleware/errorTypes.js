class AppError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message) {
        super(message);
    }
}

class AuthenticationError extends AppError {
    constructor(message) {
        super(message);
    }
}

class NotFoundError extends AppError {
    constructor(message) {
        super(message);
    }
}

class AuthorizationError extends AppError {
    constructor(message) {
        super(message);
    }
}

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    NotFoundError,
    AuthorizationError
}; 