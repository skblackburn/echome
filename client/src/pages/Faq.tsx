import { Layout } from "@/components/Layout";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqItems = [
  {
    question: "What is an Echo?",
    answer:
      "An Echo is a digital representation of someone's writing voice. By uploading documents, letters, emails, and journals written by a person, Echo Me learns how they write \u2014 their tone, vocabulary, sentence patterns, and personality. You can then have conversations with the Echo, and it responds the way that person would write.",
  },
  {
    question: "What is a milestone message?",
    answer:
      "A milestone message is a message you can schedule for important life moments \u2014 birthdays, graduations, weddings, anniversaries, or any date that matters. Your Echo will generate a heartfelt message written in your person\u2019s unique voice, delivered on the date you choose. It\u2019s like receiving a letter from someone who knows you, on the days that matter most.",
  },
  {
    question: "What types of documents should I upload?",
    answer:
      "The best sources are personal writing where someone\u2019s true voice comes through: journal entries, personal letters, emails they wrote, text messages, social media posts, cards, notes, speeches, or blog entries. Work emails they authored are good too. Avoid uploading content they didn\u2019t write \u2014 forwarded messages, templates, or shared documents with multiple authors.",
  },
  {
    question: "How many documents do I need?",
    answer:
      "We recommend starting with at least 5\u201310 documents. The sweet spot is 20\u201330 documents \u2014 enough for the AI to capture nuance in how someone writes when they\u2019re happy, serious, casual, or formal. You can always add more over time to improve accuracy.",
  },
  {
    question: "What about email threads?",
    answer:
      "For best results, upload only the parts written by your person. If an email has a back-and-forth thread, copy just the portions they wrote and remove the reply chains and forwarded text. Cleaner input means a more accurate Echo.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. Your uploaded documents and conversations are private to your account. We use encryption, secure authentication, and row-level security so only you can access your data. We never read your documents \u2014 only the AI processes them. We never sell or share your data. You can delete everything at any time.",
  },
  {
    question: "Can I edit or delete documents I uploaded?",
    answer:
      "Yes. Go to your Echo\u2019s page and open the document library. You can view all uploaded documents, edit any document\u2019s text, or delete individual documents. Editing or deleting a document will automatically update your Echo\u2019s writing style analysis.",
  },
  {
    question: "Can I delete an Echo?",
    answer:
      "Yes. On your Echo\u2019s page, you\u2019ll find a delete option. Deleting an Echo permanently removes all of its documents, conversations, and writing style data. You\u2019ll need to confirm by typing the Echo\u2019s name. This cannot be undone.",
  },
  {
    question: "How does the coupon code work?",
    answer:
      "If you have a beta coupon code (like BETA2026), enter it on the pricing page when choosing a plan. The coupon will unlock the Legacy tier (10 Echoes, unlimited messages) for free for 6 months. After 6 months, you can choose to continue on a paid plan or switch to the free tier.",
  },
  {
    question: "What happens if I cancel my account?",
    answer:
      "Cancelling your account deactivates it and stops your subscription. All of your data \u2014 Echoes, documents, and conversations \u2014 is saved. You can come back anytime, log in, and reactivate your account with all your data intact.",
  },
  {
    question: "What happens if I delete my account?",
    answer:
      "Deleting your account permanently removes everything \u2014 your profile, all Echoes, all uploaded documents, all conversations, and all writing style data. This cannot be undone. Only choose this if you\u2019re sure you want everything gone.",
  },
  {
    question: "What\u2019s the difference between Cancel and Delete?",
    answer:
      "Cancel keeps your data safe and lets you come back later. Delete permanently erases everything. If you\u2019re unsure, cancel first \u2014 you can always delete later, but you can\u2019t undo a deletion.",
  },
];

export default function Faq() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-4">
            <HelpCircle className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-foreground mb-2">
            Frequently Asked Questions
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            Everything you need to know about Echo Me, from getting started to managing your account.
          </p>
        </div>

        {/* Accordion */}
        <Accordion type="single" collapsible className="space-y-2">
          {faqItems.map((item, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
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
    </Layout>
  );
}
