"use client";

import { useState } from "react";
import { PageTitle, Segmented } from "../../ui";
import { ImageStudio } from "./images";
import { VideoStudio } from "./video";

type Tab = "video" | "beeld";

/** Beeld- en videostudio (plan §3.4) */
export default function Studio() {
  const [tab, setTab] = useState<Tab>("video");
  return (
    <div className="space-y-4">
      <PageTitle title="Studio">
        <Segmented label="Soort" value={tab} onChange={setTab} options={[{ value: "video", label: "Filmpjes" }, { value: "beeld", label: "Afbeeldingen" }]} />
      </PageTitle>
      {tab === "video" ? <VideoStudio /> : <ImageStudio />}
    </div>
  );
}
