import sharp from "sharp";
import { detectImageType, MAX_IMAGE_BYTES } from "../profile/profile.images";

export type ListImageKind = "thumbnail" | "banner";

export async function prepareListImage(buffer: Buffer, kind: ListImageKind): Promise<Buffer> {
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
        throw Object.assign(new Error("A imagem deve ter entre 1 byte e 2 MB."), { status: 413 });
    }
    if (!detectImageType(buffer)) throw Object.assign(new Error("Use uma imagem JPEG, PNG ou WebP."), { status: 415 });
    try {
        const image = sharp(buffer, { limitInputPixels: 16_000_000, failOn: "warning", animated: false });
        const metadata = await image.metadata();
        if (!metadata.width || !metadata.height || metadata.width < 64 || metadata.height < 64 ||
            metadata.width > 8000 || metadata.height > 8000 || (metadata.pages ?? 1) !== 1) {
            throw Object.assign(new Error("Use uma imagem estática entre 64 e 8000 pixels por lado, até 16 megapixels."), { status: 422 });
        }
        const [width, height] = kind === "thumbnail" ? [512, 512] : [1600, 480];
        const output = await image.rotate().resize(width, height, { fit: "cover" }).flatten({ background: "#17201e" }).jpeg({ quality: 85 }).toBuffer();
        if (output.length > MAX_IMAGE_BYTES) throw Object.assign(new Error("A imagem processada excedeu 2 MB. Use outra imagem."), { status: 413 });
        return output;
    } catch (error) {
        if (error instanceof Error && "status" in error) throw error;
        throw Object.assign(new Error("Imagem inválida ou danificada. Use JPEG, PNG ou WebP estático com até 16 megapixels."), { status: 422, cause: error });
    }
}
