import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

function pixelStats(buffer){
  const png=PNG.sync.read(buffer);
  const colors=new Set();
  let count=0, sum=0, sumSq=0;
  for(let y=0;y<png.height;y+=4){
    for(let x=0;x<png.width;x+=4){
      const i=(y*png.width+x)*4;
      const r=png.data[i], g=png.data[i+1], b=png.data[i+2];
      const luminance=0.2126*r+0.7152*g+0.0722*b;
      colors.add(`${r>>4},${g>>4},${b>>4}`);
      sum+=luminance; sumSq+=luminance*luminance; count++;
    }
  }
  const mean=sum/count;
  return {colors:colors.size,stdDev:Math.sqrt(sumSq/count-mean*mean)};
}

async function expectRendered(canvas){
  const stats=pixelStats(await canvas.screenshot());
  expect(stats.colors,JSON.stringify(stats)).toBeGreaterThan(20);
  expect(stats.stdDev,JSON.stringify(stats)).toBeGreaterThan(5);
}

function collectPageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  return errors;
}

test('desktop gameplay, AI steering, weapons, and pause flow',async({page})=>{
  const pageErrors=collectPageErrors(page);
  await page.goto('/');

  const canvas=page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('#start')).toBeVisible();
  await expectRendered(canvas);

  // Focused command buttons retain native Space activation.
  await page.locator('#start-btn').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#hud')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__game?.running)).toBe(true);

  const initial=await page.evaluate(()=>({
    enemies:window.__game.enemies.length,
    alive:window.__game.enemies.filter(enemy=>enemy.alive).length,
    ammo:window.__game.player.mgAmmo,
  }));
  expect(initial).toMatchObject({enemies:8,alive:8,ammo:1600});

  const flightSafety=await page.evaluate(async()=>{
    const {terrainH}=await import('/src/world.js');
    const {CFG}=await import('/src/config.js');
    const {bullets}=await import('/src/bullets.js');
    const game=window.__game;
    const originalEnemies=game.enemies;
    game.paused=true;

    const steeringEnemy=originalEnemies[0];
    steeringEnemy.state='engage'; steeringEnemy.stateT=999; steeringEnemy.fireCd=999;
    steeringEnemy.group.position.set(0,500,0); steeringEnemy.group.quaternion.identity(); steeringEnemy.vel.set(0,0,0);
    game.player.group.position.set(300,500,0); game.player.vel.set(0,0,0);
    game.enemies=[steeringEnemy];
    steeringEnemy.update(1,game.player);
    const forward=new window.__THREE.Vector3(0,0,-1).applyQuaternion(steeringEnemy.group.quaternion);
    const toPlayer=game.player.group.position.clone().sub(steeringEnemy.group.position).normalize();
    const forwardDotToPlayer=forward.dot(toPlayer);

    const firingEnemy=originalEnemies[3];
    bullets.reset(); game.enemies=[firingEnemy];
    firingEnemy.group.position.set(0,500,0); firingEnemy.group.quaternion.identity(); firingEnemy.vel.set(0,0,0);
    firingEnemy.state='engage'; firingEnemy.stateT=999; firingEnemy.fireCd=0;
    game.player.group.position.set(0,500,-300); game.player.vel.set(0,0,0);
    firingEnemy.update(0.016,game.player);
    const enemyShots=bullets.items.filter(bullet=>bullet.grp.visible&&bullet.from===1).length;
    bullets.reset();

    const groundEnemy=originalEnemies[1];
    groundEnemy.group.position.set(800,terrainH(800,800)-2,800); groundEnemy.vel.set(0,-20,0);
    game.enemies=originalEnemies;
    groundEnemy.update(0.016,game.player);

    const boundaryEnemy=originalEnemies[2];
    boundaryEnemy.group.position.set(CFG.worldR+100,500,0); boundaryEnemy.vel.set(150,0,0);
    boundaryEnemy.state='engage'; boundaryEnemy.stateT=999; boundaryEnemy.fireCd=999;
    boundaryEnemy.update(0.1,game.player);
    const boundaryRadius=Math.hypot(boundaryEnemy.group.position.x,boundaryEnemy.group.position.z);

    game.player.group.position.set(CFG.worldR+100,500,0); game.player.vel.set(150,0,0);
    game.player.update(0.016,{has:()=>false,fireMG:false,fireCannon:false});
    const playerBoundaryRadius=Math.hypot(game.player.group.position.x,game.player.group.position.z);

    const returnStartRadius=CFG.worldR*0.9;
    game.player.group.position.set(returnStartRadius,700,0); game.player.vel.set(0,0,0); game.player.throttle=0;
    for(let i=0;i<80;i++){
      game.player.physics(0.05,game.player.vel.length()); game.player.enforceWorldBounds();
    }
    const playerReturnRadius=Math.hypot(game.player.group.position.x,game.player.group.position.z);

    game.enemies=originalEnemies; game.paused=false;
    return {forwardDotToPlayer,enemyShots,groundEnemyAlive:groundEnemy.alive,boundaryRadius,playerBoundaryRadius,
      returnStartRadius,playerReturnRadius,worldR:CFG.worldR};
  });
  expect(flightSafety.forwardDotToPlayer).toBeGreaterThan(0.5);
  expect(flightSafety.enemyShots).toBeGreaterThan(0);
  expect(flightSafety.groundEnemyAlive).toBe(false);
  expect(flightSafety.boundaryRadius).toBeLessThanOrEqual(flightSafety.worldR+0.01);
  expect(flightSafety.playerBoundaryRadius).toBeLessThanOrEqual(flightSafety.worldR+0.01);
  expect(flightSafety.playerReturnRadius).toBeLessThan(flightSafety.returnStartRadius-100);

  const ammoBefore=await page.evaluate(()=>window.__game.player.mgAmmo);
  await page.mouse.move(720,450);
  await page.mouse.down({button:'left'});
  await page.waitForTimeout(300);
  await page.mouse.up({button:'left'});
  await expect.poll(()=>page.evaluate(()=>window.__game.player.mgAmmo)).toBeLessThan(ammoBefore);

  await page.keyboard.press('p');
  await expect.poll(()=>page.evaluate(()=>window.__game.paused)).toBe(true);
  await expect(page.locator('#msg')).toHaveText('PAUSED');
  await page.waitForTimeout(1500);
  await expect(page.locator('#msg')).toHaveText('PAUSED');
  await page.keyboard.press('p');
  await expect.poll(()=>page.evaluate(()=>window.__game.paused)).toBe(false);
  await expectRendered(canvas);

  // A death raised from inside the active frame must leave the engine muted.
  await page.evaluate(()=>{ window.__game.player.update=()=>window.__game.lose('TEST'); });
  await expect.poll(()=>page.evaluate(()=>window.__game.over)).toBe(true);
  await page.waitForTimeout(350);
  const engineGain=await page.evaluate(async()=>{
    const {SFX}=await import('/src/audio.js'); return SFX.engGain?.gain.value??0;
  });
  expect(engineGain).toBeLessThan(0.02);
  expect(pageErrors).toEqual([]);
});

test('bullet pools and match resources reset without duplicates',async({page})=>{
  const pageErrors=collectPageErrors(page);
  await page.goto('/');
  await page.locator('#start-btn').click();
  await expect.poll(()=>page.evaluate(()=>window.__game?.running)).toBe(true);

  const result=await page.evaluate(async()=>{
    const {bullets}=await import('/src/bullets.js');
    const {parts,debris,explosion,resetVfx}=await import('/src/vfx.js');
    const {terrainH}=await import('/src/world.js');
    const {HUD}=await import('/src/hud.js');
    const {solveBallisticLead}=await import('/src/ballistics.js');
    const game=window.__game;
    game.paused=true;
    bullets.reset(); resetVfx();

    // Force a target hit at ground height; recycle must happen exactly once.
    const hitPosition=new window.__THREE.Vector3(300,terrainH(300,300)+0.2,300);
    let hits=0;
    const target={alive:true,group:{position:hitPosition.clone()},damage(){ hits++; }};
    bullets.fire(hitPosition,new window.__THREE.Vector3(0,-1,0),{life:1,dmg:1,from:0,color:0xffffff,size:1});
    bullets.update(0.001,game.player,[target]);
    const bulletPool={free:bullets.free.length,unique:new Set(bullets.free).size,total:bullets.items.length,hits};

    const shooterPosition=new window.__THREE.Vector3(20,500,-40);
    const shooterVelocity=new window.__THREE.Vector3(120,-5,-30);
    const targetPosition=new window.__THREE.Vector3(500,610,-900);
    const targetVelocity=new window.__THREE.Vector3(-35,12,80);
    const direction=new window.__THREE.Vector3();
    const gravity=9.2,projectileSpeed=900;
    const interceptTime=solveBallisticLead(direction,shooterPosition,shooterVelocity,targetPosition,targetVelocity,projectileSpeed,gravity,2);
    const projectile=shooterPosition.clone().addScaledVector(shooterVelocity,interceptTime)
      .addScaledVector(direction,projectileSpeed*interceptTime);
    projectile.y-=gravity*interceptTime*interceptTime*0.5;
    const targetAtIntercept=targetPosition.clone().addScaledVector(targetVelocity,interceptTime);
    const ballisticMiss=projectile.distanceTo(targetAtIntercept);

    bullets.reset();
    const terminalPosition=new window.__THREE.Vector3(0,600,0);
    let postVictoryPlayerHits=0;
    const terminalPlayer={alive:true,group:{position:terminalPosition.clone()},damage(){ postVictoryPlayerHits++; this.alive=false; }};
    const lastEnemy={alive:true,group:{position:terminalPosition.clone()},damage(){ this.alive=false; }};
    // Allocation order makes the player round update first; once it kills the
    // final enemy, the pending enemy round must not create a contradictory KIA.
    bullets.fire(terminalPosition,new window.__THREE.Vector3(0,0,-1),{life:1,dmg:1,from:1,color:0xffffff,size:1});
    bullets.fire(terminalPosition,new window.__THREE.Vector3(0,0,-1),{life:1,dmg:1,from:0,color:0xffffff,size:1});
    bullets.update(0.001,terminalPlayer,[lastEnemy]);
    const terminalCollision={enemyAlive:lastEnemy.alive,postVictoryPlayerHits};
    bullets.reset(); resetVfx();

    // Track every player-owned GPU resource through a real restart.
    const geometries=new Set(),materials=new Set();
    game.player.group.traverse(object=>{ if(!object.isMesh) return;
      if(object.geometry) geometries.add(object.geometry);
      const objectMaterials=Array.isArray(object.material)?object.material:[object.material];
      for(const material of objectMaterials) if(material) materials.add(material);
    });
    let disposedGeometries=0,disposedMaterials=0;
    for(const geometry of geometries) geometry.addEventListener('dispose',()=>disposedGeometries++);
    for(const material of materials) material.addEventListener('dispose',()=>disposedMaterials++);

    explosion(game.player.group.position);
    HUD.kill('TEST');
    const activeBefore={
      particles:parts.items.filter(item=>item.spr.visible).length,
      debris:debris.items.filter(item=>item.m.visible).length,
      killfeed:document.querySelector('#killfeed').childElementCount,
    };
    const oldGroup=game.player.group;
    game.restart();
    const activeAfter={
      bullets:bullets.items.filter(item=>item.grp.visible).length,
      particles:parts.items.filter(item=>item.spr.visible).length,
      debris:debris.items.filter(item=>item.m.visible).length,
      killfeed:document.querySelector('#killfeed').childElementCount,
    };
    return {
      bulletPool,interceptTime,ballisticMiss,terminalCollision,activeBefore,activeAfter,oldGroupDetached:oldGroup.parent===null,
      geometries:geometries.size,materials:materials.size,disposedGeometries,disposedMaterials,
    };
  });

  expect(result.bulletPool).toMatchObject({free:520,unique:520,total:520,hits:1});
  expect(result.interceptTime).toBeGreaterThan(0);
  expect(result.ballisticMiss).toBeLessThan(0.05);
  expect(result.terminalCollision).toEqual({enemyAlive:false,postVictoryPlayerHits:0});
  expect(result.activeBefore.particles).toBeGreaterThan(0);
  expect(result.activeBefore.debris).toBeGreaterThan(0);
  expect(result.activeBefore.killfeed).toBe(1);
  expect(result.activeAfter).toEqual({bullets:0,particles:0,debris:0,killfeed:0});
  expect(result.oldGroupDetached).toBe(true);
  expect(result.disposedGeometries).toBe(result.geometries);
  expect(result.disposedMaterials).toBe(result.materials);
  expect(pageErrors).toEqual([]);
});

test.describe('touch layout',()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});

  test('mobile HUD and multi-touch controls remain usable',async({page,context})=>{
    const pageErrors=collectPageErrors(page);
    await page.goto('/');
    const card=await page.locator('#start .card').boundingBox();
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x+card.width).toBeLessThanOrEqual(390);
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y+card.height).toBeLessThanOrEqual(844);

    await page.locator('#start-btn').tap();
    await expect(page.locator('#touch-controls')).toBeVisible();
    await page.evaluate(()=>{ window.__game.player.hp=window.__game.player.maxhp=1_000_000; });
    await expectRendered(page.locator('canvas'));

    await page.evaluate(()=>document.documentElement.style.setProperty('--safe-top','47px'));
    const layout=await page.evaluate(()=>{
      const rect=id=>document.querySelector(id).getBoundingClientRect().toJSON();
      const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
      const health=rect('#health-wrap'),flight=rect('#fl-left'),top=rect('#fl-top');
      const utility=rect('.touch-utility'),weapons=rect('#fl-right');
      return {healthFlight:overlaps(health,flight),topUtility:overlaps(top,utility),weaponsUtility:overlaps(weapons,utility)};
    });
    expect(layout).toEqual({healthFlight:false,topUtility:false,weaponsUtility:false});

    async function hold(control,duration){
      const box=await page.locator(`[data-control="${control}"]`).boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
      await page.mouse.down(); await page.waitForTimeout(duration); await page.mouse.up();
    }

    const throttleBefore=await page.evaluate(()=>window.__game.player.throttle);
    await hold('throttle-up',500);
    await expect.poll(()=>page.evaluate(()=>window.__game.player.throttle)).toBeGreaterThan(throttleBefore);

    const cdp=await context.newCDPSession(page);
    const rollBox=await page.locator('[data-control="roll-left"]').boundingBox();
    const fireBox=await page.locator('[data-control="fire-mg"]').boundingBox();
    const touches=[
      {x:rollBox.x+rollBox.width/2,y:rollBox.y+rollBox.height/2,id:11,radiusX:2,radiusY:2,force:1},
      {x:fireBox.x+fireBox.width/2,y:fireBox.y+fireBox.height/2,id:12,radiusX:2,radiusY:2,force:1},
    ];
    const ammoBefore=await page.evaluate(()=>window.__game.player.mgAmmo);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});
    await page.waitForTimeout(350);
    const simultaneous=await page.evaluate(()=>({
      ammo:window.__game.player.mgAmmo,
      roll:window.__game.player.angVel.z,
      rollPressed:document.querySelector('[data-control="roll-left"]').classList.contains('is-pressed'),
      firePressed:document.querySelector('[data-control="fire-mg"]').classList.contains('is-pressed'),
    }));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    expect(simultaneous.ammo).toBeLessThan(ammoBefore);
    expect(simultaneous.roll).toBeGreaterThan(0.1);
    expect(simultaneous.rollPressed).toBe(true);
    expect(simultaneous.firePressed).toBe(true);

    const duplicatePointerState=await page.evaluate(async()=>{
      const button=document.querySelector('[data-control="fire-mg"]');
      button.setPointerCapture=()=>{};
      const send=(type,pointerId)=>button.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId,pointerType:'touch'}));
      send('pointerdown',91); send('pointerdown',92); send('pointerup',91);
      const {input}=await import('/src/input.js');
      const afterOneRelease={pressed:button.classList.contains('is-pressed'),firing:input.fireMG};
      send('pointerup',92);
      return {afterOneRelease,afterAllRelease:{pressed:button.classList.contains('is-pressed'),firing:input.fireMG}};
    });
    expect(duplicatePointerState.afterOneRelease).toEqual({pressed:true,firing:true});
    expect(duplicatePointerState.afterAllRelease).toEqual({pressed:false,firing:false});

    await page.locator('[data-control="pause"]').tap();
    await expect.poll(()=>page.evaluate(()=>window.__game.paused)).toBe(true);
    await expect(page.locator('[data-control="pause"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('[data-control="pause"]')).toHaveAttribute('aria-label','Resume');
    await page.locator('[data-control="pause"]').tap();
    await expect.poll(()=>page.evaluate(()=>window.__game.paused)).toBe(false);
    await expect(page.locator('[data-control="pause"]')).toHaveAttribute('aria-pressed','false');
    await expect(page.locator('[data-control="pause"]')).toHaveAttribute('aria-label','Pause');
    await page.locator('[data-control="camera"]').tap();
    await expect(page.locator('[data-control="camera"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('[data-control="camera"]')).toHaveAttribute('aria-label','Switch to chase camera');
    expect(pageErrors).toEqual([]);
  });
});

test.describe('compact touch layout',()=>{
  test.use({viewport:{width:320,height:568},isMobile:true,hasTouch:true});

  test('start card fits a compact phone viewport',async({page})=>{
    await page.goto('/');
    const card=await page.locator('#start .card').boundingBox();
    const button=await page.locator('#start-btn').boundingBox();
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x+card.width).toBeLessThanOrEqual(320);
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y+card.height).toBeLessThanOrEqual(568);
    expect(button.y).toBeGreaterThanOrEqual(card.y);
    expect(button.y+button.height).toBeLessThanOrEqual(card.y+card.height);
  });
});
