"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { AlertCircle, CheckCircle } from "lucide-react"

export default function Upload() {
  const [file, setFile] = useState<File | null>(null)
  const [messageFile, setMessageFile] = useState<File | null>(null)
  const [startBit, setStartBit] = useState(0)
  const [length, setLength] = useState(8)
  const [mode, setMode] = useState("simple")
  const [action, setAction] = useState("hide")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()
  const { data: session, status } = useSession()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Please select a carrier file")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData()
    formData.append("file", file)
    if (messageFile) formData.append("messageFile", messageFile)
    formData.append("startBit", startBit.toString())
    formData.append("length", length.toString())
    formData.append("mode", mode)
    formData.append("action", action)

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        if (action === "hide") {
          setSuccess("File processed successfully")
          router.push(`/gallery?newImage=${encodeURIComponent(data.url)}`)
        } else {
          setSuccess("Message extracted successfully")
          // Create a download link for the extracted file
          const blob = new Blob([Buffer.from(data.message, "base64")])
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = "extracted_message"
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || "An error occurred")
      }
    } catch (error) {
      setError("An unexpected error occurred")
      console.error("Error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === "loading") {
    return <p>Loading...</p>
  }

  if (status === "unauthenticated") {
    router.push("/api/auth/signin")
    return null
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Steganography Tool</h1>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <AlertCircle className="inline-block mr-2" />
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      {success && (
        <div
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          <CheckCircle className="inline-block mr-2" />
          <span className="block sm:inline">{success}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="file" className="block mb-2">
            Select Carrier File (max 10MB):
          </label>
          <input
            type="file"
            id="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="action" className="block mb-2">
            Action:
          </label>
          <select
            id="action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="hide">Hide Message</option>
            <option value="extract">Extract Message</option>
          </select>
        </div>
        {action === "hide" && (
          <div>
            <label htmlFor="messageFile" className="block mb-2">
              Message File (max 1MB):
            </label>
            <input
              type="file"
              id="messageFile"
              onChange={(e) => setMessageFile(e.target.files?.[0] || null)}
              className="w-full p-2 border rounded"
            />
          </div>
        )}
        <div>
          <label htmlFor="startBit" className="block mb-2">
            Start Bit:
          </label>
          <input
            type="number"
            id="startBit"
            value={startBit}
            onChange={(e) => setStartBit(Number.parseInt(e.target.value))}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="length" className="block mb-2">
            Length (Periodicity):
          </label>
          <input
            type="number"
            id="length"
            value={length}
            onChange={(e) => setLength(Number.parseInt(e.target.value))}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label htmlFor="mode" className="block mb-2">
            Mode:
          </label>
          <select
            id="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="simple">Simple</option>
            <option value="enhanced">Enhanced</option>
          </select>
        </div>
        <button
          type="submit"
          className={`bg-blue-500 text-white px-4 py-2 rounded ${isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-600"}`}
          disabled={isLoading}
        >
          {isLoading ? "Processing..." : action === "hide" ? "Hide Message" : "Extract Message"}
        </button>
      </form>
    </div>
  )
}

