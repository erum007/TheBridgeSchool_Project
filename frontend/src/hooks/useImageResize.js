import { useEffect } from "react";

export default function useImageResize(quillRef) {
    useEffect(() => {
        if (!quillRef.current) return;

        const quill = quillRef.current.getEditor();
        const root = quill.root;

        function imageClicked(e) {
            if (e.target.tagName !== "IMG") return;

            console.log("Selected image", e.target);

            root.querySelectorAll("img").forEach(img => {
                img.style.outline = "";
            });

            e.target.style.outline = "2px solid #3b82f6";
        }

        root.addEventListener("click", imageClicked);

        return () => {
            root.removeEventListener("click", imageClicked);
        };
    }, [quillRef]);
}