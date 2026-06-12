// UploadGuidance — replaced by inline writing guidance panel inside DocumentLibrary.
// This route now redirects back to the Folder to keep navigation clean.
import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

export default function UploadGuidance() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate(`/persona/${params.id}/folder`);
  }, []);

  return null;
}
