import { Composition } from "remotion";
import { DexlyyProductTour } from "./DexlyyProductTour";

export function RemotionRoot() {
  return (
    <Composition
      id="DexlyyProductTour"
      component={DexlyyProductTour}
      durationInFrames={600}
      fps={30}
      width={1280}
      height={720}
    />
  );
}
