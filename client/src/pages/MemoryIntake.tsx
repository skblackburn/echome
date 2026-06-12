// MemoryIntake removed — replaced by Folder-first architecture.
// All memory creation goes through the Folder system.
// This route redirects to the persona's Folder.
import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

export default function MemoryIntake() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  useEffect(() => { navigate(`/persona/${params.id}/folder`); }, []);
  return null;
}
