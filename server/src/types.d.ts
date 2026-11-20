declare module "cors";
declare module "cookie-parser";
declare module "bcrypt";
declare module "jsonwebtoken";
declare namespace Express { interface Request { cookies?: Record<string, string> } }
