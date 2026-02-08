import ApiError from "../error/ApiError.js";
import httpCode from "../utils/httpStatus.js";
const notFound = (req, _res, next) => {
    next(new ApiError(httpCode.NOT_FOUND, `Route not found: ${req.originalUrl}`));
};
export default notFound;
//# sourceMappingURL=notFound.js.map