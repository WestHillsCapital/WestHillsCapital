import { useState } from "react";
import { FieldReview } from "./FieldReview";
import { ReviewStats } from "./ReviewStats";
import { VisualMapper } from "./VisualMapper";
import { INITIAL_FIELDS } from "./types";
import type { ReviewField } from "./types";

type Step = "review" | "stats" | "mapper";

export function AcroFormFlow() {
  const [step, setStep] = useState<Step>("review");
  const [resolvedFields, setResolvedFields] = useState<ReviewField[]>(INITIAL_FIELDS);

  const handleOpenMapper = (fields: ReviewField[]) => {
    setResolvedFields(fields);
    setStep("stats");
  };

  if (step === "stats") {
    return (
      <ReviewStats
        fields={resolvedFields}
        onContinue={() => setStep("mapper")}
      />
    );
  }

  if (step === "mapper") {
    return (
      <VisualMapper
        fields={resolvedFields}
        onBack={() => setStep("review")}
      />
    );
  }

  return (
    <FieldReview onOpenMapper={handleOpenMapper} />
  );
}
