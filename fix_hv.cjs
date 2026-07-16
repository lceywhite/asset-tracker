var fs = require("fs");
var c = fs.readFileSync("D:\\BBB\\Project\\CodeX\\Personal\\asset-tracker\\src\\views\\HomeView.vue", "utf8");

// 1. Remove old addItemToSection function
c = c.replace(
  /async function addItemToSection\(sec\)\{[^}]+\}\nfunction sectionBags\(sec\)\{[^}]+\}\nfunction sectionRooms\(sec\)\{[^}]+\}\n/g,
  ""
);

// 2. Add currentSection ref and openCreateInSection
c = c.replace(
  "const editMode=ref(false);const deleteConfirm=ref({show:false,type:'',id:''});const newSecType=ref('bag');let lpTimer=null",
  "const editMode=ref(false);const deleteConfirm=ref({show:false,type:'',id:''});const newSecType=ref('bag');const currentSection=ref(null);let lpTimer=null"
);

// 3. Add openCreateInSection before createBag
c = c.replace(
  "async function createBag(){",
  "function openCreateInSection(sec){currentSection.value=sec;if(sec.type==='bag')showCreateBag.value=true;else showCreateRoom.value=true}\nasync function createBag(){"
);

// 4. Modify createBag to associate with section
c = c.replace(
  "const b=await bagStore.create({name:g.value.trim(),icon:E.value});O.value=false",
  "const b=await bagStore.create({name:g.value.trim(),icon:E.value});if(currentSection.value){currentSection.value.bagIds.push(b.id);require('./sectionService.cjs'?UPDATE:secSvc).update(currentSection.value.id,{bagIds:currentSection.value.bagIds});sectionStore.loadAll();currentSection.value=null}O.value=false"
);

// Actually, for the section association, use the import * as secSvc
c = c.replace(
  "if(currentSection.value){currentSection.value.bagIds.push(b.id);require('./sectionService.cjs'?UPDATE:secSvc).update(currentSection.value.id,{bagIds:currentSection.value.bagIds});sectionStore.loadAll();currentSection.value=null}O.value=false",
  "if(currentSection.value){currentSection.value.bagIds.push(b.id);secSvc.update(currentSection.value.id,{bagIds:currentSection.value.bagIds});sectionStore.loadAll();currentSection.value=null}O.value=false"
);

// 5. Modify createRoom (xe is the minified name) to associate with section
c = c.replace(
  "async function xe(){g.value.trim()&&(await S.create({name:g.value.trim(),icon:E.value}),R.value=!1,g.value=\"\")}",
  "async function xe(){if(!g.value.trim())return;const r=await S.create({name:g.value.trim(),icon:E.value});if(currentSection.value){currentSection.value.roomIds.push(r.id);secSvc.update(currentSection.value.id,{roomIds:currentSection.value.roomIds});sectionStore.loadAll();currentSection.value=null}R.value=false;g.value=\"\"}"
);

// 6. Change dashed button click handler
c = c.replace(
  '@click="addItemToSection(s)"',
  '@click="openCreateInSection(s)"'
);

fs.writeFileSync("D:\\BBB\\Project\\CodeX\\Personal\\asset-tracker\\src\\views\\HomeView.vue", c, "utf8");
console.log("Done");