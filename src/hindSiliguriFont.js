// ফন্ট ডেটা এবং সাপোর্ট ফাংশন
import { Base64 } from "js-base64";
import hindSiliguriBase64 from "./hindSiliguriBase64.txt";

export function addFontSupport(doc) {
  try {
    const fontData = Base64.decode(hindSiliguriBase64);
    doc.addFileToVFS("HindSiliguri-Regular.ttf", fontData);
    doc.addFont("HindSiliguri-Regular.ttf", "HindSiliguri", "normal");
    doc.setFont("HindSiliguri");
    return true;
  } catch (error) {
    console.error("Error loading Bengali font:", error);
    return false;
  }
}

export function getText(text) {
  return text;
}
