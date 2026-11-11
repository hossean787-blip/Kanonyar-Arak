/* One event taxonomy and one certificate family for the independent Kanonha app. */
(() => {
 'use strict';
 const items=[
  ['workshop','کارگاه آموزشی','گواهی شرکت در کارگاه','در کارگاه آموزشی'],
  ['course','دوره آموزشی','گواهی شرکت در دوره','دوره آموزشی'],
  ['conference','همایش و سمینار','گواهی مشارکت علمی','در همایش یا سمینار'],
  ['session','نشست و سخنرانی','گواهی شرکت در نشست','در نشست تخصصی'],
  ['competition','مسابقه','گواهی شرکت در مسابقه','در مسابقه'],
  ['festival','جشنواره و نمایشگاه','گواهی مشارکت فرهنگی و هنری','در جشنواره یا نمایشگاه'],
  ['volunteer','فعالیت داوطلبانه','گواهی همکاری داوطلبانه','در فعالیت داوطلبانه'],
  ['collaboration','همکاری در برگزاری','گواهی همکاری در برگزاری','در برگزاری رویداد'],
  ['general','سایر رویدادها','گواهی مشارکت','در رویداد']
 ].map(([id,label,certificateTitle,context])=>Object.freeze({id,label,certificateTitle,context}));
 const allowed=new Set(items.map(x=>x.id));
 const normalize=id=>allowed.has(id)?id:'general';
 const get=id=>items.find(x=>x.id===normalize(id));
 function options(selected=''){
  return '<option value=""'+(!selected?' selected':'')+' disabled>نوع رویداد را انتخاب کنید</option>'+
   items.map(x=>'<option value="'+x.id+'"'+(x.id===selected?' selected':'')+'>'+x.label+'</option>').join('');
 }
 window.KanonhaEventKinds=Object.freeze({items:Object.freeze(items),normalize,get,options});
})();
