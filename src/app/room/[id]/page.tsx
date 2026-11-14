import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RoomClient, JoinSkeleton } from "@/components/RoomClient";
import { isValidRoomId } from "@/lib/room-id";

export const metadata: Metadata = {
  title: "Room",
  robots: { index: false, follow: false },
};

async function Room({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidRoomId(id)) notFound();
  return <RoomClient roomId={id} />;
}

export default function RoomPage({ params }: PageProps<"/room/[id]">) {
  return (
    <Suspense
      fallback={
        <main id="main" className="grid flex-1 place-items-center px-4 py-16">
          <JoinSkeleton />
        </main>
      }
    >
      <Room params={params} />
    </Suspense>
  );
}
