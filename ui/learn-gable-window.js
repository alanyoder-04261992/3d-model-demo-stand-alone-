/* The selected opening supplies dimensions; example values are editable,
   never a shop-wide window size or an assumed manufacturer's clearance. */
export function createGableWindowControls(example, onChange) {
  const get=id=>document.getElementById("gable-window-"+id);
  const form=get("controls"),kind=get("kind"),fields=get("dimensions"),message=get("message");
  get("width").value=example.widthIn;get("height").value=example.heightIn;
  const params=new URLSearchParams(location.search);
  if(params.get("window")==="1") kind.value="window";
  function read() {
    fields.hidden=kind.value!=="window";fields.disabled=fields.hidden;
    if(kind.value==="none") return null;
    if(kind.value==="fake") return {kind:"fake"};
    return {kind:"window",widthIn:get("width").valueAsNumber,heightIn:get("height").valueAsNumber,
      centerIn:get("center").valueAsNumber,bottomIn:get("bottom").value===""?null:get("bottom").valueAsNumber};
  }
  function apply(event) {
    event?.preventDefault();
    const input=read();
    if(!form.reportValidity())return;
    try {
      onChange(input);message.textContent=kind.value==="fake"
        ? "Gable backing is omitted. Framing for a fake window remains to be learned."
        : kind.value==="window"?"Box updated. Opening dimensions control the side studs and crosspieces.":"Regular gable studs and backing restored.";
    }catch(error){message.textContent="Not applied: "+error.message+" The last valid drawing is still shown.";}
  }
  form.hidden=false;form.addEventListener("submit",apply);kind.addEventListener("change",apply);
  return {read};
}
