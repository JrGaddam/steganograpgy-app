import Link from "next/link"
import { getServerSession } from "next-auth/next"
import { authOptions } from "./api/auth/[...nextauth]/route"

export default async function Home() {
  const session = await getServerSession(authOptions)

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Steganography Web Service</h1>
      <nav>
        <ul className="flex space-x-4">
          {session ? (
            <>
              <li>
                <Link href="/upload" className="text-blue-500 hover:underline">
                  Upload File (Authenticated)
                </Link>
              </li>
              <li>
                <Link href="/api/auth/signout" className="text-blue-500 hover:underline">
                  Sign Out
                </Link>
              </li>
            </>
          ) : (
            <li>
              <Link href="/api/auth/signin" className="text-blue-500 hover:underline">
                Sign In
              </Link>
            </li>
          )}
          <li>
            <Link href="/gallery" className="text-blue-500 hover:underline">
              View Gallery (Public)
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  )
}

