import crypto from "crypto";

function generateSessionId(size = 32) {
    return crypto.randomBytes(size).toString("hex");
}

export default generateSessionId;