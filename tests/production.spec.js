import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

function renderedPixelStats(buffer){
  const png=PNG.sync.read(buffer);
  const colors=new Set();
  let count=0,sum=0,sumSq=0;
  for(let y=0;y<png.height;y+=4){
    for(let x=0;x<png.width;x+=4){
      const i=(y*png.width+x)*4;
      const r=png.data[i],g=png.data[i+1],b=png.data[i+2];
      const luminance=.2126*r+.7152*g+.0722*b;
      colors.add(`${r>>4},${g>>4},${b>>4}`); sum+=luminance; sumSq+=luminance*luminance; count++;
    }
  }
  const mean=sum/count;
  return {colors:colors.size,stdDev:Math.sqrt(sumSq/count-mean*mean)};
}

test('production bundle boots, renders, and accepts fire input',async({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible();
  expect(await page.evaluate(()=>typeof window.__game)).toBe('undefined');

  await page.locator('#start-btn').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#ammo-mg')).toHaveText('1600');
  await page.mouse.move(640,360);
  await page.mouse.down({button:'left'}); await page.waitForTimeout(300); await page.mouse.up({button:'left'});
  await expect.poll(async()=>Number(await page.locator('#ammo-mg').textContent())).toBeLessThan(1600);

  const stats=renderedPixelStats(await page.locator('canvas').screenshot());
  expect(stats.colors,JSON.stringify(stats)).toBeGreaterThan(20);
  expect(stats.stdDev,JSON.stringify(stats)).toBeGreaterThan(5);
  expect(pageErrors).toEqual([]);
});
