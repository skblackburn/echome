import { useEffect } from "react";
import { Layout } from "@/components/Layout";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSection {
  id: string;
  title: string;
  items: FaqItem[];
}

const faqSections: FaqSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    items: [
      {
        question: "What is Echo Me?",
        answer:
          "Echo Me is a place to keep the voices that matter most — your own, and the people you love. You can write letters to be delivered in the future, keep a private journal, record voice entries, save photo memories, and — if you choose — build an AI Echo that captures how someone writes and speaks. We built it for families who want a private place for letters, stories, and memories that won't get lost.",
      },
      {
        question: "Do I have to use AI to use Echo Me?",
        answer:
          "No. Echo Me is built so that AI is optional, not central. The Folder — where you write letters and stories to your family — works fully without AI. So do journaling, photo memories, voice recording, family trees, and heir transfer. New accounts have all AI features off by default. You can turn them on one at a time in Settings if you want, or never.",
      },
      {
        question:
          "What's the difference between an Echo, a Folder, and a journal?",
        answer:
          "A Folder is a personal space where you write letters and stories for a specific person — your daughter, your partner, a future grandchild. Letters can be delivered on dates you choose. A journal is your private writing space with optional AI reflections and voice recording. An Echo is an AI feature (off by default) — it learns how someone writes from uploaded documents so you can have conversations in their voice. You can use any of these independently.",
      },
      {
        question: "How do I get started?",
        answer:
          "Sign up, and you'll land on your home page. From there you can create a Folder for someone you want to write to, start a journal entry, upload a photo memory, or — if you turn on AI features in Settings — create an Echo. There's no wrong way to begin. Most people start by writing a single letter.",
      },
      {
        question: "Who is Echo Me for?",
        answer:
          "Anyone who wants their words to outlast the moment. Parents writing to their children. People preserving the voice of someone they've lost. Someone facing a terminal diagnosis who wants to leave letters for the future. A grandparent who wants their grandchildren to know them. You don't need a reason bigger than wanting to be remembered as you actually are.",
      },
    ],
  },
  {
    id: "folder",
    title: "The Folder, letters & stories",
    items: [
      {
        question: "What is the Folder?",
        answer:
          "The Folder is a per-person space where you write letters and stories for someone specific. Think of it like a drawer in a desk — one for your daughter, one for your partner, one for a friend. Inside each Folder you can write letters with delivery rules (send anytime, on a specific date, at a milestone, or sealed until your passing) and stories that live alongside them. No AI involved.",
      },
      {
        question: "How are letters delivered?",
        answer:
          "When a letter's delivery date arrives, the recipient gets an email notification and an in-app notification. The email contains a link to read the full letter inside Echo Me. If a letter hasn't been opened after a week, we send you (the author) a gentle reminder so you can follow up or resend.",
      },
      {
        question: "Can I schedule a letter for years in the future?",
        answer:
          "Yes. You can set a delivery date as far out as you'd like — next week, five years from now, your daughter's 30th birthday. You can also set letters to deliver on milestones (like a graduation or wedding) or seal them until after your passing. The letter stays safely stored until its moment comes.",
      },
      {
        question:
          "What happens if my recipient's email changes before delivery?",
        answer:
          "If the delivery email bounces, we'll notify you so you can update the address and resend. This is one reason we send you a reminder when a letter goes unread — it helps catch changed addresses early. You can update a recipient's email in the Folder at any time before delivery.",
      },
      {
        question: "Can I resend a letter?",
        answer:
          "Yes. Every delivered letter has a resend button. If someone missed it, changed email addresses, or you just want to send it again, one click re-delivers the notification. You'll also get a reminder one week after delivery if the letter hasn't been opened.",
      },
      {
        question: "Can I edit or cancel a scheduled letter?",
        answer:
          "Yes. Any letter that hasn't been delivered yet can be edited or cancelled from its Folder. Once a letter has been delivered, you can still view it, but the delivered version is what the recipient received. You can always write a new one.",
      },
      {
        question: "Who can see what I've written in a Folder?",
        answer:
          "Only you — until delivery. A Folder's letters and stories are private to your account. The recipient only sees a letter when it's delivered. Stories in the Folder are visible to your designated heirs after inheritance, but not before.",
      },
      {
        question: "What's the difference between a letter and a story?",
        answer:
          "A letter is written to someone and has a delivery rule — a date, a milestone, or a condition like 'after I'm gone.' A story is more of a keepsake — a memory, an anecdote, something you want to preserve alongside the letters. Stories don't get delivered on a schedule; they live in the Folder for your heirs to find.",
      },
      {
        question:
          "Can I write to someone who doesn't have an Echo Me account?",
        answer:
          "Yes. Letters are delivered by email, so your recipient doesn't need an account to read them. If they want to reply, save their letters, or eventually inherit your Folder, they'll need to create an account — but that's up to them.",
      },
    ],
  },
  {
    id: "journal",
    title: "Journal",
    items: [
      {
        question: "What's the journaling feature for?",
        answer:
          "It's a private space to write — for yourself, not for delivery. You can use it to reflect, process, remember, or just put words somewhere safe. If you turn on AI reflections in Settings, the journal can offer gentle prompts and reflections after you write. But it works perfectly well as a plain, quiet journal too.",
      },
      {
        question: "Can I record voice journal entries?",
        answer:
          "Yes. You can record audio directly in the journal. If you enable voice transcription in Settings, your recordings are transcribed using Whisper (OpenAI's speech-to-text model) so you have both the audio and a searchable text version. Transcription is optional — you can record voice-only if you prefer.",
      },
      {
        question: "Are my journal entries private?",
        answer:
          "Yes. Journal entries are visible only to you. They aren't shared with family, heirs, or anyone else. They aren't included in any AI Echo training. Your journal is yours alone.",
      },
      {
        question: "Can I share a journal entry with family?",
        answer:
          "Not directly — the journal is intentionally private. If you want to share something you wrote in your journal, you can copy it into a letter in someone's Folder and deliver it to them. This keeps the boundary clear: the journal is for you, the Folder is for them.",
      },
    ],
  },
  {
    id: "photo-memories",
    title: "Photo memories",
    items: [
      {
        question: "What are photo memories?",
        answer:
          "Photo memories let you upload photos and pair them with a written memory — a caption, a story, the context that makes the photo matter. Years from now, your family won't just have the image; they'll have what it meant to you.",
      },
      {
        question: "Can I add photos without using the AI?",
        answer:
          "Yes. Photo memories work with or without AI. If AI features are on, you'll get optional prompts to help you write about the photo ('What were you feeling?' or 'Who else was there?'). If AI is off, you just upload the photo and write whatever you want. The prompts are a nudge, not a requirement.",
      },
      {
        question: "What happens to my photos?",
        answer:
          "Your photos are stored securely with your account. They're private to you unless they're part of a Folder that eventually passes to your heirs. We don't use your photos for AI training, advertising, or anything other than showing them back to you (and eventually, to whoever inherits your account).",
      },
    ],
  },
  {
    id: "ai-features",
    title: "AI features",
    items: [
      {
        question: "Do I have to use AI?",
        answer:
          "No. Echo Me is built so that AI is optional, not central. The Folder — where you write letters and stories to your family — works fully without AI. So do journaling, photo memories, voice recording, family trees, and heir transfer. New accounts have all AI features off by default. You can turn them on one at a time in Settings if you want, or never.",
      },
      {
        question: "Can I turn off the AI?",
        answer:
          "Yes, any time. Go to Settings and you'll find individual toggles for each AI feature — Echo chat, journal reflections, photo prompts, and voice transcription. Turn off what you don't want. Turn off everything if you prefer. Your letters, journal, and photos all work without any AI at all.",
      },
      {
        question: "What does AI Echo chat actually do?",
        answer:
          "When you create an Echo and upload documents written by someone (letters, emails, journal entries), the AI learns their writing patterns — vocabulary, tone, sentence structure, personality. You can then have a text conversation with the Echo, and it responds in a way that resembles how that person would write. It's an approximation, not a resurrection — a way to feel closer, not a replacement.",
      },
      {
        question:
          "Why does the AI sometimes not sound exactly like my loved one?",
        answer:
          "Because the AI is an approximation, not them. It learns from what you upload, and it gets closer the more you give it — letters, journals, recorded voice, family stories — but it will never sound exactly like the person, and we don't think it should. The Echo is a way to remember them, ask the kinds of questions you wish you could, and feel a little closer. It is not them. We try to make this clear throughout the app, because confusing the two would be unkind to both of you.",
      },
      {
        question:
          "Where do my conversations and documents go when AI is on?",
        answer:
          "Your uploaded documents and AI conversations are stored on our servers, tied to your account. When you chat with an Echo, the relevant documents are sent to OpenAI's API to generate responses. OpenAI does not use your data for training their models (per their API data usage policy). Your documents and conversation history remain in your account and are never shared with other users.",
      },
      {
        question: "What data is sent to OpenAI?",
        answer:
          "When you chat with an Echo, we send the relevant uploaded documents and your conversation history to OpenAI's API so it can generate a response in that person's voice. If you use voice transcription, your audio is sent to OpenAI's Whisper model for transcription. If you use AI journal reflections, your journal entry text is sent for the reflection. Nothing is sent unless you actively use an AI feature, and OpenAI's API policy prohibits them from using your data for training.",
      },
      {
        question: "Will the AI ever pretend to be human?",
        answer:
          "No. We design the Echo experience to be clear about what it is — a reflection built from someone's writing, not the person themselves. The interface always indicates you're talking to an Echo, not a human. We believe honesty about what AI can and can't do is essential, especially when grief and love are involved.",
      },
      {
        question: "Can I delete my AI conversation history?",
        answer:
          "Yes. You can delete individual conversations or your entire conversation history with an Echo. Deleting an Echo removes all associated documents, conversations, and writing style data permanently. You're always in control of what stays and what goes.",
      },
    ],
  },
  {
    id: "echoes",
    title: "Echoes (when AI is on)",
    items: [
      {
        question: "What is an Echo?",
        answer:
          "An Echo is a digital representation of someone's writing voice. By uploading documents, letters, emails, and journals written by a person, Echo Me learns how they write — their tone, vocabulary, sentence patterns, and personality. You can then have conversations with the Echo, and it responds the way that person would write. It requires AI features to be turned on in Settings.",
      },
      {
        question: "What types of documents should I upload?",
        answer:
          "The best sources are personal writing where someone's true voice comes through: journal entries, personal letters, emails they wrote, text messages, social media posts, cards, notes, speeches, or blog entries. Work emails they authored are good too. Avoid uploading content they didn't write — forwarded messages, templates, or shared documents with multiple authors.",
      },
      {
        question: "How many documents do I need?",
        answer:
          "We recommend starting with at least 5–10 documents. The sweet spot is 20–30 documents — enough for the AI to capture nuance in how someone writes when they're happy, serious, casual, or formal. You can always add more over time to improve accuracy.",
      },
      {
        question: "What about email threads?",
        answer:
          "For best results, upload only the parts written by your person. If an email has a back-and-forth thread, copy just the portions they wrote and remove the reply chains and forwarded text. Cleaner input means a more accurate Echo.",
      },
      {
        question: "Can I edit or delete documents I uploaded?",
        answer:
          "Yes. Go to your Echo's page and open the document library. You can view all uploaded documents, edit any document's text, or delete individual documents. Editing or deleting a document will automatically update your Echo's writing style analysis.",
      },
      {
        question: "Can I delete an Echo?",
        answer:
          "Yes. On your Echo's page, you'll find a delete option. Deleting an Echo permanently removes all of its documents, conversations, and writing style data. You'll need to confirm by typing the Echo's name. This cannot be undone.",
      },
      {
        question: "What is a milestone message?",
        answer:
          "A milestone message is a message you can schedule for important life moments — birthdays, graduations, weddings, anniversaries, or any date that matters. Your Echo will generate a heartfelt message written in your person's unique voice, delivered on the date you choose. It's like receiving a letter from someone who knows you, on the days that matter most.",
      },
    ],
  },
  {
    id: "family",
    title: "Family, heirs & inheritance",
    items: [
      {
        question: "Can I share an Echo with my family?",
        answer:
          "Yes. You can invite family members to access an Echo you've created. Each person interacts with the Echo in their own private conversation — they can ask their own questions and have their own experience without seeing yours. Family sharing requires the people you invite to have Echo Me accounts.",
      },
      {
        question: "What happens to my Echoes after I die?",
        answer:
          "They go to whoever you've designated as your heir (or heirs). When you set up an Echo, you choose who inherits it. After your passing, your heir can claim the Echo through a simple verification process, and from that point they have access to everything you wanted them to have — your letters to them, your Folder, the Echo itself. If you have multiple heirs, you can split access among them. If you have no heir designated, your account is preserved for two years before deletion, in case family contacts us.",
      },
      {
        question: "How do I designate an heir?",
        answer:
          "Go to your Echo or Folder settings and you'll find an option to designate an heir. You'll enter their name and email address. They'll receive a notification that they've been named, but they won't have access to anything until the inheritance process is triggered. You can change your heir designation at any time.",
      },
      {
        question: "Can I have multiple heirs?",
        answer:
          "Yes. You can designate multiple heirs and split access among them. Each heir can inherit different Echoes or Folders, or you can give multiple heirs access to the same ones. This is useful for families where you want each child to have their own space while sharing some memories.",
      },
      {
        question:
          "What if I want to leave my Folder to someone who doesn't have an account?",
        answer:
          "They don't need an account today. When your Folder is released to them, they'll get an email inviting them to create a free Echo Me account. The free tier is enough to receive everything you left — letters, photos, voice notes, stories. They can keep their inherited Folder forever on the free tier. No payment required, ever.",
      },
      {
        question: "Can my heirs add their own memories to an Echo?",
        answer:
          "Yes, once an heir inherits an Echo they can upload additional documents to enrich it — new letters they've found, recordings, or writings they want to add to that person's voice. The original material you uploaded stays intact alongside anything new.",
      },
      {
        question:
          "What if my heirs disagree about what should be in an Echo?",
        answer:
          "This is a real concern, and one we've thought about. When an Echo has multiple heirs, each heir can fork their own private copy of the Echo to add or change material — this way, no heir's vision overrides another's. The original Echo stays as the parent created it, and each fork carries the heir's name. If you'd like family conversations about what stays in the original, that's between you all — we just make sure no single heir can erase what another remembers.",
      },
      {
        question:
          "How does someone inherit my Folder? What's the verification process?",
        answer:
          "We're designing this carefully. For beta, heirs are added by the original user with an email and relationship. When we move to production, the inheritance flow will involve trusted contacts and confirmation of passing (such as a death certificate) before sealed content is released. We'll never release a Folder without proper verification.\n\nIf you have specific concerns about how this should work for your situation, reach out — we're listening.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & data",
    items: [
      {
        question: "Is my data secure?",
        answer:
          "Yes. We use encryption in transit and at rest, secure authentication, and row-level database security so only you can access your data. We don't sell or share your data with third parties. You can delete your data at any time. We're a small team and we treat your words the way we'd want ours treated — carefully.",
      },
      {
        question: "Who can read what I write?",
        answer:
          "Your letters, journal entries, stories, and photo memories are private to your account. Letters become visible to their recipient only when delivered. Folders and their contents pass to your designated heirs after inheritance. Journal entries are never visible to anyone but you. AI conversations are between you and the Echo.",
      },
      {
        question: "Can the Echo Me team read my letters?",
        answer:
          "During beta: technically, yes — our small team has database access, which means they could read what you write. We use this access only to debug issues, fix bugs, and make sure features work — never for any other reason, never shared.\n\nAs we move out of beta: we're working toward end-to-end encryption for sealed-until-passing letters and a Local Only privacy mode where your writing never leaves your device. These are on the roadmap for late 2026.\n\nWhat we will never do: sell your data, train AI models on your letters, or give anyone access without your permission.\n\nFor maximum privacy now: keep your Folder set to 'sealed until passing' and turn off AI features in Settings. Your letters still live on our servers but aren't read unless we have a specific debug reason.",
      },
      {
        question: "Where is my data stored?",
        answer:
          "Your data is stored on servers in the United States. This applies to all users regardless of location. We disclose this at signup. We don't currently have separate regional servers, but your data is encrypted and access-controlled wherever it lives.",
      },
      {
        question: "Can I export all my data?",
        answer:
          "Yes. Go to Settings → Account and you'll find a data export option. This gives you a complete copy of everything in your account — letters, journal entries, stories, photos, Echo documents, and conversation history. It's your data; you should always be able to take it with you.",
      },
      {
        question: "What happens to my data if Echo Me shuts down?",
        answer:
          "If we ever have to shut down, we'll give you at least 90 days' notice and make sure you can export everything before the lights go off. Your letters and memories are too important to just disappear. We're building Echo Me to last, but we plan for the worst because that's what responsible stewardship looks like.",
      },
      {
        question: "Are you HIPAA compliant?",
        answer:
          "No. Echo Me is not a healthcare app and we don't accept or process protected health information (PHI). If you're using Echo Me to write to family from a hospice or medical context, please be thoughtful about what medical details you include — we treat your data carefully, but we are not subject to HIPAA's specific requirements. For deeply private medical wishes, we recommend keeping those in a separate document with your healthcare proxy.",
      },
      {
        question: "What about GDPR / users in Europe?",
        answer:
          "We honor the rights GDPR provides — you can export your data, request deletion, and ask what we have on you. Use Settings → Account to do any of these directly, or email us at support@echome.family. We don't currently have separate EU-region servers, so your data lives in the same place as US users (United States), which we disclose at signup.",
      },
    ],
  },
  {
    id: "billing",
    title: "Account, billing & subscription",
    items: [
      {
        question: "Can my friend just sign up?",
        answer:
          "Yes. Anyone can sign up for a free Echo Me account at app.echome.family — no payment, no credit card. The free tier includes one persona, unlimited letters and stories in The Folder, voice journaling (5/month), photo memories (3 lifetime), and AI reflections (3/month, if you turn AI on). It's a real free tier, not a trial — keep it free forever if it meets your needs.",
      },
      {
        question: "How does the coupon code work?",
        answer:
          "If you have a coupon code, enter it on the pricing page when choosing a plan. The coupon will apply the corresponding discount to your subscription. After the coupon period ends, you can choose to continue on a paid plan or switch to the free tier.",
      },
      {
        question: "What happens if I cancel my account?",
        answer:
          "Cancelling your account deactivates it and stops your subscription. All of your data — Echoes, documents, letters, journal entries, and conversations — is saved. You can come back anytime, log in, and reactivate your account with all your data intact. Scheduled letters will pause until you reactivate.",
      },
      {
        question: "What happens if I delete my account?",
        answer:
          "Deleting your account permanently removes everything — your profile, all Echoes, all uploaded documents, all letters, journal entries, photos, conversations, and all writing style data. This cannot be undone. Only choose this if you're sure you want everything gone.",
      },
      {
        question: "What's the difference between Cancel and Delete?",
        answer:
          "Cancel keeps your data safe and lets you come back later. Delete permanently erases everything. If you're unsure, cancel first — you can always delete later, but you can't undo a deletion.",
      },
      {
        question: "What are the differences between the tiers?",
        answer:
          "Free gives you 1 Echo and 20 messages per month — enough to try things out. Personal ($9/month) gives you more Echoes and messages for individual use. Family ($15/month) is for families who want multiple Folders and shared access. Legacy ($22/month) is the full experience — 10 Echoes, unlimited messages, priority support, and every feature we build. All tiers include letters, journaling, photo memories, and voice recording. AI features are available on all tiers but always optional.",
      },
      {
        question:
          "Will I lose access to letters I've already written if I downgrade?",
        answer:
          "No. Letters you've already written and delivered are yours. If you downgrade to Free, you'll keep access to everything you've created — you just won't be able to create beyond the Free tier limits until you upgrade again. We don't hold your words hostage.",
      },
      {
        question: "Can I get a refund?",
        answer:
          "If you're unhappy with Echo Me, reach out to support@echome.family within 30 days of a charge and we'll make it right. We're a small team and we'd rather have an honest conversation about what didn't work than keep money that doesn't feel earned.",
      },
      {
        question: "Will my price change over time?",
        answer:
          "We may adjust pricing for new subscribers as we grow, but if you're on a plan, we'll grandfather your rate for at least a year and give you plenty of notice before any change. We don't believe in surprising people with price hikes.",
      },
      {
        question: "How do I contact Echo Me?",
        answer:
          "Email us at support@echome.family. We read every message. For privacy, security, or sensitive concerns about how Echo Me handles your data or your loved ones, please flag it in your subject line and we'll prioritize.",
      },
    ],
  },
  {
    id: "sensitive",
    title: "Sensitive topics",
    items: [
      {
        question:
          "I'm grieving — is this app appropriate for me right now?",
        answer:
          "It depends. Echo Me can be a beautiful place to write to someone you've lost, to keep their voice alive, or to leave letters for the family who'll need you later. But it's not a replacement for grieving, and the AI features in particular can sometimes feel like a way around grief rather than through it. If you're in the early, sharp stages of loss, we'd gently suggest writing to your loved one in your Folder (just letters, no AI) and saving the AI chat for later, if at all. If your grief feels overwhelming, please consider reaching out to a real human — a therapist, a grief group, or a crisis line: 988 (US), 116 123 (UK Samaritans), 9-8-8 (Canada), 13 11 14 (Australia), or findahelpline.com for other countries. You can also reach us at support@echome.family. Echo Me is here when you're ready, and only if it feels right.",
      },
      {
        question:
          "I'm dying. Can I use this to leave things for my family?",
        answer:
          "Yes — this is one of the most important things Echo Me is for. You can write letters now to be delivered to specific people on specific dates or moments. You can record voice messages or upload photos with stories. You can leave letters for grandchildren who haven't been born yet, for moments you won't be there for. None of this requires AI — it's all your real words, in your real voice, delivered to the people you love. If you need help getting started, email us at support@echome.family.",
      },
      {
        question: "Is Echo Me a substitute for therapy?",
        answer:
          "No. Echo Me is a place to write, remember, and preserve — but it's not therapy and shouldn't replace professional support. If you're struggling, please reach out to a licensed therapist or a crisis line: 988 (Suicide and Crisis Lifeline, US — call or text, 24/7), 116 123 (Samaritans, UK), 9-8-8 (Talk Suicide Canada), 13 11 14 (Lifeline Australia), or findahelpline.com for an international directory. If you are in immediate danger, call your local emergency number. Writing can be part of healing, but it works best alongside real human connection, not instead of it.",
      },
      {
        question:
          "What if I write something concerning in a journal entry?",
        answer:
          "Your journal is private and we don't monitor its contents. But if you or someone you know is in crisis, please reach out: 988 (call or text, US), Crisis Text Line (text HOME to 741741, US), 116 123 (UK Samaritans), 9-8-8 (Canada), 13 11 14 (Australia), or findahelpline.com for other countries. If you are in immediate danger, call your local emergency number. Echo Me is a place for your words, but real humans are better equipped to help in a crisis.",
      },
      {
        question:
          "What if a child uses this to talk to a deceased parent?",
        answer:
          "This is something we think about deeply. The AI Echo feature can bring comfort, but it can also be confusing — especially for a young person. We recommend that any child using Echo Me does so with the guidance of a trusted adult, and that AI chat is introduced carefully, with honest conversation about what an Echo is and isn't. The letters and Folder features — real words from a real person, delivered when the time is right — may be a gentler starting point.",
      },
    ],
  },
  {
    id: "technical",
    title: "Technical",
    items: [
      {
        question: "What devices does Echo Me work on?",
        answer:
          "Echo Me is a web app that works in any modern browser — Chrome, Safari, Firefox, Edge — on desktop, tablet, or phone. No downloads required. Just go to the site and log in.",
      },
      {
        question: "Is there a mobile app?",
        answer:
          "Not yet. Echo Me works well in your phone's browser, and we've designed it to be mobile-friendly. A dedicated mobile app is something we're considering as we grow, but for now the web app is the best way to use Echo Me on any device.",
      },
      {
        question: "What if I find a bug?",
        answer:
          "Please tell us. Email support@echome.family with what happened, what you expected, and what device/browser you were using. We're a small team and we fix things quickly. Bugs in something this personal feel especially important to squash.",
      },
      {
        question: "How do I contact support?",
        answer:
          "Email us at support@echome.family. We're a small team and we respond personally — usually within a day. No ticket numbers, no chatbots. Just a real reply from someone who cares about what you're building here.",
      },
    ],
  },
];

export default function Faq() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    const section = params.get("s");
    if (section) {
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-4">
            <HelpCircle className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground mb-3">
            Frequently Asked Questions
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
            Echo Me was built for families who want a private place for
            letters, stories, and memories that won't get lost. Your words,
            kept safe, delivered when they matter most. Here's everything
            you might want to know.
          </p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-10 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Jump to a section
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {faqSections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#/faq?s=${section.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById(section.id)
                      ?.scrollIntoView({ behavior: "smooth" });
                    history.replaceState(null, "", `#/faq?s=${section.id}`);
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sections */}
        {faqSections.map((section) => (
          <div key={section.id} id={section.id} className="mb-10 scroll-mt-8">
            <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground mb-4">
              {section.title}
            </h2>
            <Accordion type="single" collapsible className="space-y-2">
              {section.items.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`${section.id}-${index}`}
                  className="rounded-xl border border-border bg-card px-5 overflow-hidden transition-colors hover:bg-muted/30"
                >
                  <AccordionTrigger className="text-left font-sans text-sm font-semibold text-foreground hover:no-underline py-4">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-sm text-muted-foreground">
            Still have questions? Email{" "}
            <a
              href="mailto:support@echome.family"
              className="text-primary hover:underline"
            >
              support@echome.family
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
}
