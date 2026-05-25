import type { TCaptionElement, TResizableProps, TVideoElement } from "platejs";
import { NodeApi } from "platejs";
import type { SlateElementProps } from "platejs/static";
import { SlateElement } from "platejs/static";
import * as React from "react";

const createCaptionTrackUrl = (text: string) => {
  const vtt = `WEBVTT\n\n00:00.000 --> 00:05.000\n${text}`;
  const blob = new Blob([vtt], { type: "text/vtt" });
  return URL.createObjectURL(blob);
};

export const VideoElementStatic = (
  props: SlateElementProps<TVideoElement & TCaptionElement & TResizableProps>,
) => {
  const { align = "center", caption, url, width } = props.element;
  const captionText = React.useMemo(() => {
    if (!caption?.length) return "";
    return NodeApi.string(caption[0]).trim();
  }, [caption]);

  const placeholderTrackUrl = React.useMemo(() => createCaptionTrackUrl(""), []);
  const [trackUrl, setTrackUrl] = React.useState(placeholderTrackUrl);
  const trackUrlRef = React.useRef(placeholderTrackUrl);

  React.useEffect(() => {
    const previousUrl = trackUrlRef.current;
    const captionTrackUrl = createCaptionTrackUrl(captionText);
    trackUrlRef.current = captionTrackUrl;
    setTrackUrl(captionTrackUrl);

    if (previousUrl && previousUrl !== captionTrackUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    return () => {
      URL.revokeObjectURL(captionTrackUrl);
    };
  }, [captionText]);

  return (
    <SlateElement className="py-2.5" {...props}>
      <div style={{ textAlign: align }}>
        <figure className="group relative m-0 inline-block cursor-default" style={{ width }}>
          <video className="w-full max-w-full rounded-sm object-cover px-0" src={url} controls>
            <track kind="captions" srcLang="en" label="Transcript" src={trackUrl} default />
          </video>
          {caption && <figcaption>{NodeApi.string(caption[0])}</figcaption>}
        </figure>
      </div>
      {props.children}
    </SlateElement>
  );
};
