import { useState } from "react";
import { FieldReview } from "./FieldReview";
import { VisualMapper } from "./VisualMapper";
import { INITIAL_FIELDS } from "./types";
import type { ReviewField } from "./types";

export function AcroFormFlow() {
  const [step, setStep] = useState<"review" | "mapper">("review");
  const [mapperFields, setMapperFields] = useState<ReviewField[]>(INITIAL_FIELDS);

  const handleOpenMapper = (fields: ReviewField[]) => {
    setMapperFields(fields);
    setStep("mapper");
  };

  if (step === "mapper") {
    return (
      <VisualMapper
        fields={mapperFields}
        onBack={() => setStep("review")}
      />
    );
  }

  return (
    <FieldReview onOpenMapper={handleOpenMapper} />
  );
}
