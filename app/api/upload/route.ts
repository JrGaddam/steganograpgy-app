import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]/route"
import sharp from "sharp"
import crypto from "crypto"

const SUPPORTED_IMAGE_FORMATS = ["jpeg", "jpg", "png", "webp", "gif"]
const SUPPORTED_VIDEO_FORMATS = ["mp4", "avi", "mov"]
const SUPPORTED_AUDIO_FORMATS = ["mp3", "wav", "ogg"]
const SUPPORTED_DOC_FORMATS = ["txt", "doc", "docx", "pdf"]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_MESSAGE_SIZE = 1 * 1024 * 1024 // 1 MB

function hideMessage(buffer: Buffer, message: Buffer, startBit: number, length: number, mode: string): Buffer {
  const messageBits = message
    .toString("binary")
    .split("")
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("")
  let messageIndex = 0

  for (let i = startBit; i < buffer.length * 8 && messageIndex < messageBits.length; i += length) {
    const byteIndex = Math.floor(i / 8)
    const bitIndex = i % 8

    const currentByte = buffer[byteIndex]
    const messageBit = Number.parseInt(messageBits[messageIndex])

    buffer[byteIndex] = (currentByte & ~(1 << (7 - bitIndex))) | (messageBit << (7 - bitIndex))

    messageIndex++

    if (mode === "enhanced") {
      length = ((length * 2) % 32) + 8
    }
  }

  // Add end of message marker
  const endMarker = "00000011" // ASCII End of Text character
  for (let i = 0; i < 8; i++) {
    const byteIndex = Math.floor((startBit + messageIndex * length + i) / 8)
    const bitIndex = (startBit + messageIndex * length + i) % 8
    const currentByte = buffer[byteIndex]
    const markerBit = Number.parseInt(endMarker[i])
    buffer[byteIndex] = (currentByte & ~(1 << (7 - bitIndex))) | (markerBit << (7 - bitIndex))
  }

  return buffer
}

function extractMessage(buffer: Buffer, startBit: number, length: number, mode: string): Buffer {
  let extractedBits = ""
  let i = startBit
  let endMarkerFound = false

  while (i < buffer.length * 8 && !endMarkerFound) {
    const byteIndex = Math.floor(i / 8)
    const bitIndex = i % 8
    const bit = (buffer[byteIndex] >> (7 - bitIndex)) & 1
    extractedBits += bit

    if (extractedBits.length % 8 === 0) {
      const char = String.fromCharCode(Number.parseInt(extractedBits.slice(-8), 2))
      if (char === "\u0003") {
        // ASCII End of Text character
        endMarkerFound = true
        extractedBits = extractedBits.slice(0, -8) // Remove end marker
      }
    }

    i += length
    if (mode === "enhanced") {
      length = ((length * 2) % 32) + 8
    }
  }

  const extractedBytes = new Uint8Array(extractedBits.match(/.{1,8}/g)!.map((byte) => Number.parseInt(byte, 2)))
  return Buffer.from(extractedBytes)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const data = await request.formData()
    const file: File | null = data.get("file") as unknown as File
    const messageFile: File | null = data.get("messageFile") as unknown as File
    const startBit: number = Number.parseInt(data.get("startBit") as string)
    const length: number = Number.parseInt(data.get("length") as string)
    const mode: string = data.get("mode") as string
    const action: string = data.get("action") as string // 'hide' or 'extract'

    if (!file) {
      return NextResponse.json({ error: "No carrier file uploaded" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Carrier file size exceeds the maximum limit" }, { status: 400 })
    }

    let fileExtension = file.name.split(".").pop()?.toLowerCase()
    if (
      !fileExtension ||
      ![
        ...SUPPORTED_IMAGE_FORMATS,
        ...SUPPORTED_VIDEO_FORMATS,
        ...SUPPORTED_AUDIO_FORMATS,
        ...SUPPORTED_DOC_FORMATS,
      ].includes(fileExtension)
    ) {
      return NextResponse.json({ error: "Unsupported file format" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    let buffer = Buffer.from(arrayBuffer)

    // Check file signature
    const fileSignature = buffer.slice(0, 4).toString("hex")
    if (!isValidFileSignature(fileSignature, fileExtension)) {
      return NextResponse.json({ error: "Invalid file signature" }, { status: 400 })
    }

    if (action === "hide") {
      if (!messageFile) {
        return NextResponse.json({ error: "No message file provided" }, { status: 400 })
      }
      if (messageFile.size > MAX_MESSAGE_SIZE) {
        return NextResponse.json({ error: "Message file size exceeds the maximum limit" }, { status: 400 })
      }
      const messageArrayBuffer = await messageFile.arrayBuffer()
      const messageBuffer = Buffer.from(messageArrayBuffer)
      buffer = hideMessage(buffer, messageBuffer, startBit, length, mode)
    } else if (action === "extract") {
      const extractedMessage = extractMessage(buffer, startBit, length, mode)
      return NextResponse.json({ success: true, message: extractedMessage.toString("base64") })
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Handle image files
    if (SUPPORTED_IMAGE_FORMATS.includes(fileExtension)) {
      const image = sharp(buffer)
      const { width, height } = await image.metadata()

      // Resize if image is too large
      if (width && height && (width > 1920 || height > 1080)) {
        await image.resize(1920, 1080, { fit: "inside" })
      }

      // Convert to PNG to preserve quality
      buffer = await image.png().toBuffer()
      fileExtension = "png"
    }

    // Generate a unique filename
    const uniqueFilename = `${crypto.randomBytes(16).toString("hex")}.${fileExtension}`

    // Upload to Vercel Blob
    const { url } = await put(uniqueFilename, buffer, { access: "public" })

    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

function isValidFileSignature(signature: string, extension: string): boolean {
  const signatures: { [key: string]: string[] } = {
    jpeg: ["ffd8ff"],
    jpg: ["ffd8ff"],
    png: ["89504e47"],
    gif: ["47494638"],
    pdf: ["25504446"],
    // Add more signatures for other file types as needed
  }

  return signatures[extension]?.some((validSignature) => signature.startsWith(validSignature)) ?? true
}

