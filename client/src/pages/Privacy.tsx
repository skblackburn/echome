import { Layout } from "@/components/Layout";
import { Shield, Lock, Eye, UserCheck, HelpCircle } from "lucide-react";
import { Link } from "wouter";

const sections = [
  {
    icon: Shield,
    title: "Your Privacy Matters",
    content: (
      <p>
        Echo Me is built on a simple promise: <strong>your memories are yours</strong>. We created
        this platform to help you preserve the voices of the people you love — and we take the
        responsibility of holding those memories seriously.
      </p>
    ),
  },
  {
    icon: Eye,
    title: "What we collect",
    content: (
      <>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Your email address and password (for your account)</li>
          <li>The documents, letters, and stories you upload</li>
          <li>Your conversations with your Echoes</li>
          <li>Family details and personality traits you share</li>
        </ul>
        <p className="mt-3">
          We only collect what you give us. We never track you across the web, sell your data, or
          show you ads.
        </p>
      </>
    ),
  },
  {
    icon: Lock,
    title: "How we protect your data",
    content: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>All data is transmitted over encrypted connections (HTTPS/TLS)</li>
        <li>Your account is protected by secure authentication</li>
        <li>Each user's data is isolated — no one else can access your Echoes</li>
        <li>We use row-level security so your data is only accessible to you</li>
      </ul>
    ),
  },
  {
    icon: Shield,
    title: "How AI processes your data",
    content: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Your documents and traits are processed by AI to create your Echo's voice</li>
        <li>We use OpenAI to generate responses — your data is sent to their API for processing</li>
        <li>OpenAI does not use API data to train their models (per their API data usage policy)</li>
        <li>We do not read, review, or access your documents or conversations</li>
      </ul>
    ),
  },
  {
    icon: UserCheck,
    title: "Your control",
    content: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Edit or delete any document you've uploaded, anytime</li>
        <li>Delete individual Echoes and all their data</li>
        <li>Export a complete backup of all your data</li>
        <li>Cancel your account (data preserved) or delete it entirely (data purged)</li>
        <li>You're always in control</li>
      </ul>
    ),
  },
];

export default function Privacy() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground mb-2">
            Privacy &amp; Trust
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            How we protect your memories and respect your privacy.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="mt-0.5 h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <section.icon className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-display text-lg font-semibold text-foreground pt-1">
                  {section.title}
                </h2>
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed pl-12">
                {section.content}
              </div>
            </div>
          ))}

          {/* Questions CTA */}
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <div className="inline-flex items-center justify-center p-2.5 rounded-full bg-primary/10 mb-3">
              <HelpCircle className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">Questions?</h2>
            <p className="text-sm text-muted-foreground mb-3">
              We're happy to answer anything about how your data is handled.
            </p>
            <Link href="/faq">
              <span className="text-sm text-primary hover:underline cursor-pointer font-medium">
                Visit our FAQ
              </span>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
