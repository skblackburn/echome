import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Heart } from "lucide-react";

export default function FinalFolder() {
  return (
    <Layout backTo="/pricing" backLabel="Pricing" title="Final Folder">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-5">
            <Heart className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground mb-3">
            Final Folder
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
            Free Legacy access for people facing a terminal illness, in hospice care, or pursuing the right to die.
          </p>
        </div>

        <Card className="p-8 paper-surface space-y-5">
          <p className="text-muted-foreground leading-relaxed">
            If you or someone you love is facing the end of life and wants to leave behind letters, stories, or a voice for their family — we want to make that possible, no matter what.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            The Final Folder program provides a free Legacy plan (our highest tier) for as long as you need it. No verification, no questions asked. After passing, your designated heir receives a free year to access and preserve everything you've left.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            This includes unlimited Folders, letters, voice recordings, journal entries, milestone messages, and — if you choose — AI features. Everything in Echo Me, for free.
          </p>

          <div className="border-t border-border pt-5">
            <h2 className="font-display font-semibold text-foreground mb-2">How to request a Final Folder code</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Send an email to the address below. Tell us what name to put the code under — that's it. No documentation needed. We trust you.
            </p>
            <a
              href="mailto:finalfolder@echome.app?subject=Final%20Folder%20request"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              finalfolder@echome.app
            </a>
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you're a hospice organization, palliative care team, or right-to-die advocacy group and would like to offer Final Folder codes to your clients, reach out at the same address. We'll work with you.
            </p>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
