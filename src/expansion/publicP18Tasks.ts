import type{ToolCategory}from'../types';
export type P18ImageMode='enhance'|'remove'|'restore'|'perspective'|'deskew'|'redeye';
export interface PublicP18Task{id:string;name:string;shortName:string;description:string;keywords:string[];mode:P18ImageMode;category:ToolCategory;featured?:boolean}
type Raw=[string,string,string,string,P18ImageMode,string?,boolean?];
const RAW:Raw[]=[
['image-enhancer','Image Enhancer','Improve photos locally with edge-preserving denoise, auto levels, local contrast, saturation, and adjustable sharpening.','image enhancer|enhance photo|denoise image|remove noise|sharpen image|deblur photo|auto levels|improve photo quality','enhance','Image Enhancer',true],
['object-remover','Object & Blemish Remover','Paint over small unwanted objects, spots, wires, or blemishes and fill the masked area locally from surrounding pixels.','object remover|remove object from photo|blemish remover|content aware fill|erase object|remove spot|remove wire','remove','Object Remover',true],
['old-photo-restorer','Old Photo Restorer','Restore faded scans locally with dust and scratch suppression, denoise, tonal recovery, color balancing, and controlled sharpening.','old photo restoration|restore old photo|fix faded photo|remove dust scratches|photo repair|restore scan','restore','Photo Restorer',true],
['perspective-corrector','Perspective Corrector','Straighten photographed artwork, signs, pages, screens, and rectangular objects with a four-corner projective warp.','perspective correction|fix perspective|keystone correction|four corner crop|straighten document|warp image','perspective','Perspective',true],
['auto-deskew-image','Auto Deskew Image','Estimate common rotational skew from image edges and rotate the photo back toward level entirely in the browser.','deskew image|straighten image|auto rotate photo|fix tilted image|level photo|deskew scan','deskew','Auto Deskew',true],
['red-eye-remover','Red-Eye Remover','Reduce red-eye in a selected circular eye region by suppressing only strongly red-dominant pixels locally.','red eye remover|fix red eyes|remove red eye|photo eye correction|red pupil','redeye','Red-Eye',false],
];
export const PUBLIC_P18_TASKS:PublicP18Task[]=RAW.map(([id,name,description,keys,mode,shortName,featured])=>({id,name,shortName:shortName||name,description,keywords:keys.split('|'),mode,category:'image',featured}));
export function getPublicP18Task(id:string|null|undefined){return id?PUBLIC_P18_TASKS.find(t=>t.id===id):undefined}
