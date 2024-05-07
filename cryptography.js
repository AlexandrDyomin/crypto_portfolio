import crypto from "crypto";

function generateRandomHexString(size = 32) {
    return crypto.randomBytes(size).toString("hex");
}

async function hash(password, saltSize = 8, hashSize = 32) {
    return new Promise((resolve, reject) => {
        const salt = generateRandomHexString(saltSize);
        crypto.scrypt(password, salt, hashSize, (err, derivedKey) => {
            if (err) reject(err);
            resolve(salt + ":" + derivedKey.toString('hex'));
        });
    })
}

async function verify(password, hash, hashSize = 32) {
    return new Promise((resolve, reject) => {
        const [salt, key] = hash.split(":");
        crypto.scrypt(password, salt, hashSize, (err, derivedKey) => {
            if (err) reject(err);
            resolve(key == derivedKey.toString('hex'));
        });
    })
}

export { generateRandomHexString, hash, verify };