import { NodeApi } from "platejs";
import type { TAudioElement, TCaptionElement } from "platejs";
import type { SlateElementProps } from "platejs/static";
import { SlateElement } from "platejs/static";
import * as React from "react";

const createCaptionTrackUrl = (text: string) => {
  const vtt = `WEBVTT\n\n00:00.000 --> 00:05.000\n${text}`;
  const blob = new Blob([vtt], { type: "text/vtt" });
  return URL.createObjectURL(blob);
};

export const AudioElementStatic = (props: SlateElementProps<TAudioElement & TCaptionElement>) => {
  const { caption } = props.element;
  const captionText = React.useMemo(() => {
    if (!caption?.length) return "";
    return NodeApi.string(caption[0]).trim();
  }, [caption]);

  const placeholderTrackUrl = React.useMemo(() => createCaptionTrackUrl(""), []);
  const [trackUrl, setTrackUrl] = React.useState(placeholderTrackUrl);
  const trackUrlRef = React.useRef(placeholderTrackUrl);

  React.useEffect(() => {
    const previousUrl = trackUrlRef.current;
    const url = createCaptionTrackUrl(captionText);
    trackUrlRef.current = url;
    setTrackUrl(url);

    if (previousUrl && previousUrl !== url) {
      URL.revokeObjectURL(previousUrl);
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [captionText]);

  return (
    <SlateElement {...props} className="mb-1">
      <figure className="group relative cursor-default">
        <div className="h-16">
          <audio className="size-full" src={props.element.url} controls>
            <track kind="captions" srcLang="en" label="Transcript" src={trackUrl} default />
          </audio>
        </div>
        {captionText && (
          <figcaption className="mt-2 text-sm text-muted-foreground">{captionText}</figcaption>
        )}
      </figure>
      {props.children}
    </SlateElement>
  );
};
