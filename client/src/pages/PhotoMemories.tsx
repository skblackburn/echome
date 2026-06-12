// Photo Memories global page removed — photos live inside Folders.
// This route redirects to the dashboard.
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function PhotoMemories() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/dashboard"); }, []);
  return null;
}
