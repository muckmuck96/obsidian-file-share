export interface IEncryptedFilePayload {
    file: string,
    aesKey: string,
    iv: string,
    filename: string,
    signature: string | null
}