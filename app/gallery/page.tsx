import Image from "next/image"
import { list } from "@vercel/blob"

export default async function Gallery() {
  const { blobs } = await list()

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Public Gallery</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {blobs.map((blob) => (
          <div key={blob.url} className="border rounded p-2">
            <Image
              src={blob.url || "/placeholder.svg"}
              alt="Steganographic image"
              width={300}
              height={200}
              className="w-full h-auto"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

