var fs = require("fs");
var c = fs.readFileSync("D:\\BBB\\Project\\CodeX\\Personal\\asset-tracker\\src\\components\\trip\\TripForm.vue", "utf8");

// 1. Check what the template @click for toggle actually uses
var idx = c.indexOf("toggleReminder(item") + 30;
console.log("ToggleReminder uses (item):", c.includes("toggleReminder(item)"));

// 2. Check the actual @click in template
var clickIdx = c.indexOf("toggleReminder");
var before = c.substring(Math.max(0, clickIdx-80), clickIdx);
console.log("Before toggleReminder:", before);

// 3. Add console.log to toggleReminder for debugging
var funcStart = c.indexOf("function toggleReminder");
var funcEnd = c.indexOf("\n}", funcStart) + 2;
var funcText = c.substring(funcStart, funcEnd);
console.log("Full function:", funcText);

// 4. Fix: add error handling to the function
var oldFunc = "function toggleReminder(item){const rt=[\"return\",\"daily\",\"selfcheck\"];const ri=rt.indexOf(item.reminderType);const ni={...item,reminderType:rt[(ri+1)%3]};const items=packingItems.value;const idx=items.indexOf(item);if(idx>=0)items[idx]=ni}";
var newFunc = "function toggleReminder(item){try{console.log('toggle',item);if(!item)return;const items=packingItems.value;const idx=items.indexOf(item);if(idx<0)return;const rt=[\"return\",\"daily\",\"selfcheck\"];const ri=rt.indexOf(item.reminderType);items[idx]={...items[idx],reminderType:rt[(ri+1)%3]};console.log('new rt',items[idx].reminderType)}catch(e){console.error('toggle err',e)}}";
c = c.replace(oldFunc, newFunc);

// 5. Fix doCombine for debugging
var dcIdx = c.indexOf("async function doCombine");
var dcEnd = c.indexOf("\n}", dcIdx) + 2;
var dcText = c.substring(dcIdx, dcEnd);
console.log("doCombine:", dcText);

fs.writeFileSync("D:\\BBB\\Project\\CodeX\\Personal\\asset-tracker\\src\\components\\trip\\TripForm.vue", c, "utf8");
console.log("Done");