import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

const MILESTONE_OPTIONS = [
  { value: "engagement", label: "Engagement" },
  { value: "birth_of_child", label: "Birth of a child" },
  { value: "graduation", label: "Graduation" },
  { value: "loss", label: "Loss of someone" },
  { value: "wedding", label: "Wedding" },
  { value: "retirement", label: "Retirement" },
  { value: "custom", label: "Custom milestone" },
];

export default function FolderLetterNew() {
  const { id } = useParams<{ id: string }>();
  const personaId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [deliveryRuleType, setDeliveryRuleType] = useState("browsable_anytime");
  const [deliverAt, setDeliverAt] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [deliveryMilestone, setDeliveryMilestone] = useState("");
  const [customMilestone, setCustomMilestone] = useState("");
  const [isSealed, setIsSealed] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        title,
        content,
        deliveryRuleType,
        recurring,
        isSealed,
      };
      if (deliveryRuleType === "date") {
        body.deliverAt = new Date(deliverAt).toISOString();
      }
      if (deliveryRuleType === "milestone") {
        body.deliveryMilestone = deliveryMilestone === "custom" ? customMilestone : deliveryMilestone;
      }
      await apiRequest("POST", `/api/personas/${personaId}/letters`, body);
    },
    onSuccess: () => {
      toast({ title: "Letter saved", description: "Your letter has been added to the folder." });
      queryClient.invalidateQueries({ queryKey: ["/api/personas", personaId, "folder"] });
      navigate(`/persona/${personaId}/folder`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = title.trim() && content.trim() &&
    (deliveryRuleType !== "date" || deliverAt) &&
    (deliveryRuleType !== "milestone" || (deliveryMilestone && (deliveryMilestone !== "custom" || customMilestone)));

  return (
    <Layout backTo={`/persona/${personaId}/folder`} backLabel="Folder" title="Write a Letter">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">Write a Letter</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Write something meaningful. Choose when it should be delivered.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. For your wedding day" />
          </div>

          <div>
            <Label htmlFor="content">Letter</Label>
            <Textarea id="content" value={content} onChange={e => setContent(e.target.value)}
              placeholder="Write your letter here..." rows={12} className="min-h-[200px]" />
          </div>

          {/* Delivery rule picker */}
          <div>
            <Label>Delivery Rule</Label>
            <Select value={deliveryRuleType} onValueChange={setDeliveryRuleType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="browsable_anytime">Browsable anytime</SelectItem>
                <SelectItem value="date">On a specific date</SelectItem>
                <SelectItem value="milestone">On a milestone</SelectItem>
                <SelectItem value="sealed_until_passing">Sealed until I'm gone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date picker for date-based delivery */}
          {deliveryRuleType === "date" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="deliverAt">Delivery Date</Label>
                <Input id="deliverAt" type="date" value={deliverAt} onChange={e => setDeliverAt(e.target.value)}
                  min={new Date(Date.now() + 86400000).toISOString().split("T")[0]} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="recurring" checked={recurring} onCheckedChange={v => setRecurring(!!v)} />
                <Label htmlFor="recurring" className="text-sm font-normal cursor-pointer">
                  Deliver every year on this date
                </Label>
              </div>
            </div>
          )}

          {/* Milestone picker */}
          {deliveryRuleType === "milestone" && (
            <div className="space-y-3">
              <div>
                <Label>Milestone</Label>
                <Select value={deliveryMilestone} onValueChange={setDeliveryMilestone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a milestone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MILESTONE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {deliveryMilestone === "custom" && (
                <div>
                  <Label htmlFor="customMilestone">Custom milestone name</Label>
                  <Input id="customMilestone" value={customMilestone} onChange={e => setCustomMilestone(e.target.value)}
                    placeholder="e.g. first day at college" />
                </div>
              )}
            </div>
          )}

          {/* Sealed checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox id="isSealed" checked={isSealed} onCheckedChange={v => setIsSealed(!!v)} />
            <Label htmlFor="isSealed" className="text-sm font-normal cursor-pointer">
              Seal this letter (recipient can't read it until the delivery rule fires)
            </Label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(`/persona/${personaId}/folder`)}>
            Cancel
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending} className="gap-2">
            <Send className="h-4 w-4" />
            {createMutation.isPending ? "Saving..." : "Save Letter"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
