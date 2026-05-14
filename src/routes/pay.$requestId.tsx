import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { getPaymentRequest, submitPaymentProof } from "@/server/payments";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/pay/$requestId")({
  head: () => ({
    meta: [
      { title: "Complete Payment — RKDF Gym" },
      { name: "description", content: "Scan the UPI QR code, pay, and submit your transaction reference." },
    ],
  }),
  component: PayPage,
});

function PayPage() {
  const { requestId } = Route.useParams();
  const navigate = useNavigate();
  const fetchReq = useServerFn(getPaymentRequest);
  const submitProof = useServerFn(submitPaymentProof);
  const [utr, setUtr] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["payment-request", requestId],
    queryFn: () => fetchReq({ data: { id: requestId } }),
  });

  const mutation = useMutation({
    mutationFn: () => submitProof({ data: { id: requestId, utr } }),
    onSuccess: () => {
      toast.success("Payment proof submitted. Awaiting admin review.");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to submit"),
  });

  if (isLoading) {
    return <div className="container mx-auto max-w-2xl py-16">Loading…</div>;
  }
  if (error || !data) {
    return (
      <div className="container mx-auto max-w-2xl py-16">
        <p className="text-destructive">{(error as any)?.message ?? "Request not found"}</p>
        <Link to="/membership" className="underline">Back to membership</Link>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    pending: "Awaiting payment",
    awaiting_review: "Awaiting admin review",
    approved: "Approved",
    rejected: "Rejected",
  };

  return (
    <div className="container mx-auto max-w-2xl py-12 px-4 space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Selected plan</div>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl">{data.plan} membership</h1>
          <div className="text-2xl font-semibold">₹{data.amount}<span className="text-sm text-muted-foreground font-normal"> / month</span></div>
        </div>
        <ol className="mt-4 space-y-1 text-sm text-muted-foreground list-decimal list-inside">
          <li>Scan the QR below with any UPI app and pay the exact amount.</li>
          <li>Copy the UTR (transaction reference) from your payment receipt.</li>
          <li>Submit the UTR here — we'll email your activation code once an admin approves.</li>
        </ol>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Pay for {data.plan} membership</CardTitle>
              <CardDescription>Scan the QR with any UPI app and pay the exact amount.</CardDescription>
            </div>
            <Badge variant={data.status === "approved" ? "default" : "secondary"}>
              {statusLabel[data.status] ?? data.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-3 rounded-lg border p-6 bg-card">
            <QRCodeSVG value={data.upi} size={224} includeMargin />
            <div className="text-center">
              <div className="text-3xl font-bold">₹{data.amount}</div>
              <div className="text-sm text-muted-foreground">
                Pay to <span className="font-medium">{data.payeeName}</span> · {data.upiId}
              </div>
            </div>
            <a
              href={data.upi}
              className="text-sm underline text-primary"
            >
              Open in UPI app
            </a>
          </div>

          {data.status === "approved" ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
              <p className="font-medium">Payment approved.</p>
              <p className="text-sm text-muted-foreground">
                Your activation code has been emailed to you. Redeem it from your dashboard.
              </p>
              <Button className="mt-3" onClick={() => navigate({ to: "/dashboard" })}>
                Go to dashboard
              </Button>
            </div>
          ) : data.status === "rejected" ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
              <p className="font-medium text-destructive">Payment rejected</p>
              {data.notes && <p className="text-sm text-muted-foreground">{data.notes}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="utr">UPI transaction reference (UTR)</Label>
                <Input
                  id="utr"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  placeholder="e.g. 412345678901"
                  maxLength={64}
                  disabled={mutation.isPending}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Find this in your UPI app payment receipt after the transaction completes.
                </p>
              </div>
              {data.utr && (
                <p className="text-sm text-muted-foreground">
                  Submitted UTR: <span className="font-mono">{data.utr}</span>
                </p>
              )}
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || utr.trim().length < 6}
                className="w-full"
              >
                {mutation.isPending ? "Submitting…" : data.utr ? "Update UTR" : "I have paid — submit UTR"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
