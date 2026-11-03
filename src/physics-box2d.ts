import Box2DFactory from 'box2d-wasm';
import type { StageDef } from './data/maps';
import type { IPhysics } from './IPhysics';
import type { MapEntity, MapEntityState } from './types/MapEntity.type';

export class Box2dPhysics implements IPhysics {
  private Box2D!: typeof Box2D & EmscriptenModule;
  private gravity!: Box2D.b2Vec2;
  private world!: Box2D.b2World;

  private marbleMap: { [id: number]: Box2D.b2Body } = {};
  private entities: ({ body: Box2D.b2Body } & MapEntityState)[] = [];

  private deleteCandidates: Box2D.b2Body[] = [];
  /** 얼음 스킬로 멈춘 구슬 id → 남은 시간(ms, 물리 시간) */
  private frozen = new Map<number, number>();
  /** 얼음이 풀린 구슬 id → 다시 얼 수 있게 되는 시각(ms, 물리 시간) */
  private freezeImmuneUntil = new Map<number, number>();
  /** 물리 시간 누적(ms). 얼음 면역 시각 계산에 쓴다 */
  private simTime = 0;
  /** 얼음 면역 시간(ms). 마지막 freeze 호출 값을 쓴다 */
  private freezeImmunity = 0;
  /** 반중력 스킬로 뜬 구슬 id → 남은 시간(ms, 물리 시간), 중력 배율, 위로 올라가는 속도 상한 */
  private floating = new Map<number, { remaining: number; scale: number; maxUpSpeed: number }>();

  async init(): Promise<void> {
    this.Box2D = await Box2DFactory();
    this.gravity = new this.Box2D.b2Vec2(0, 10);
    this.world = new this.Box2D.b2World(this.gravity);
    console.log('box2d ready');
  }

  clear(): void {
    this.clearEntities();
  }

  clearMarbles(): void {
    Object.values(this.marbleMap).forEach((body) => {
      this.world.DestroyBody(body);
    });
    this.marbleMap = {};
    this.frozen.clear();
    this.freezeImmuneUntil.clear();
    this.floating.clear();
  }

  createStage(stage: StageDef): void {
    this.createEntities(stage.entities);
  }

  createEntities(entities?: MapEntity[]) {
    if (!entities) return;

    const bodyTypes = {
      static: this.Box2D.b2_staticBody,
      kinematic: this.Box2D.b2_kinematicBody,
    } as const;

    entities.forEach((entity) => {
      const bodyDef = new this.Box2D.b2BodyDef();
      bodyDef.set_type(bodyTypes[entity.type]);
      const body = this.world.CreateBody(bodyDef);

      const fixtureDef = new this.Box2D.b2FixtureDef();
      fixtureDef.set_density(entity.props.density);
      fixtureDef.set_restitution(entity.props.restitution);

      let shape;
      switch (entity.shape.type) {
        case 'box':
          shape = new this.Box2D.b2PolygonShape();
          shape.SetAsBox(entity.shape.width, entity.shape.height, 0, entity.shape.rotation);
          fixtureDef.set_shape(shape);
          body.CreateFixture(fixtureDef);
          break;
        case 'polyline':
          shape = new this.Box2D.b2EdgeShape();
          for (let i = 0; i < entity.shape.points.length - 1; i++) {
            const p1 = entity.shape.points[i];
            const p2 = entity.shape.points[i + 1];
            const v1 = new this.Box2D.b2Vec2(p1[0], p1[1]);
            const v2 = new this.Box2D.b2Vec2(p2[0], p2[1]);
            const edge = new this.Box2D.b2EdgeShape();
            edge.SetTwoSided(v1, v2);
            body.CreateFixture(edge, 1);
          }
          break;
        case 'circle':
          shape = new this.Box2D.b2CircleShape();
          shape.set_m_radius(entity.shape.radius);
          fixtureDef.set_shape(shape);
          body.CreateFixture(fixtureDef);
          break;
      }

      body.SetAngularVelocity(entity.props.angularVelocity);
      body.SetTransform(new this.Box2D.b2Vec2(entity.position.x, entity.position.y), 0);
      this.entities.push({
        body,
        x: entity.position.x,
        y: entity.position.y,
        angle: 0,
        shape: entity.shape,
        life: entity.props.life ?? -1,
      });
    });
  }

  clearEntities() {
    this.entities.forEach((entity) => {
      this.world.DestroyBody(entity.body);
    });
    this.entities = [];
  }

  createMarble(id: number, x: number, y: number): void {
    const circleShape = new this.Box2D.b2CircleShape();
    circleShape.set_m_radius(0.25);

    const bodyDef = new this.Box2D.b2BodyDef();
    bodyDef.set_type(this.Box2D.b2_dynamicBody);
    bodyDef.set_position(new this.Box2D.b2Vec2(x, y));

    const body = this.world.CreateBody(bodyDef);
    body.CreateFixture(circleShape, 1 + Math.random());
    body.SetAwake(false);
    body.SetEnabled(false);
    this.marbleMap[id] = body;
  }

  shakeMarble(id: number): void {
    const body = this.marbleMap[id];
    if (body) {
      body.ApplyLinearImpulseToCenter(new this.Box2D.b2Vec2(Math.random() * 10 - 5, Math.random() * 10 - 5), true);
    }
  }

  removeMarble(id: number): void {
    const marble = this.marbleMap[id];
    if (marble) {
      this.world.DestroyBody(marble);
      delete this.marbleMap[id];
      this.frozen.delete(id);
      this.freezeImmuneUntil.delete(id);
      this.floating.delete(id);
    }
  }

  getMarblePosition(id: number): { x: number; y: number; angle: number } {
    const marble = this.marbleMap[id];
    if (marble) {
      const pos = marble.GetPosition();
      return { x: pos.x, y: pos.y, angle: marble.GetAngle() };
    } else {
      return { x: 0, y: 0, angle: 0 };
    }
  }

  getEntities(): MapEntityState[] {
    return this.entities.map((entity) => {
      return {
        ...entity,
        angle: entity.body.GetAngle(),
      };
    });
  }

  impact(id: number): void {
    const src = this.marbleMap[id];
    if (!src) return;

    Object.values(this.marbleMap).forEach((body) => {
      if (body === src) return;

      const distVector = new this.Box2D.b2Vec2(body.GetPosition().x, body.GetPosition().y);
      distVector.op_sub(src.GetPosition());
      const distSq = distVector.LengthSquared();

      if (distSq < 100) {
        distVector.Normalize();
        const power = 1 - distVector.Length() / 10;
        distVector.op_mul(power * power * 5);
        body.ApplyLinearImpulseToCenter(distVector, true);
      }
    });
  }

  boost(id: number, speed: number, maxSpeed: number): void {
    const body = this.marbleMap[id];
    if (!body) return;
    // 임펄스 대신 속도를 직접 더해 구슬 무게(밀도는 구슬마다 랜덤)와 상관없이 같은 효과를 낸다
    const v = body.GetLinearVelocity();
    const vy = Math.min(maxSpeed, Math.max(v.y, 0) + speed);
    body.SetLinearVelocity(new this.Box2D.b2Vec2(v.x, vy));
    body.SetAwake(true);
  }

  swapMarbles(a: number, b: number): void {
    const bodyA = this.marbleMap[a];
    const bodyB = this.marbleMap[b];
    if (!bodyA || !bodyB || bodyA === bodyB) return;

    // GetPosition 등은 내부 메모리를 가리키므로 바꾸기 전에 값을 복사해 둔다.
    // 두 자리 모두 같은 크기의 구슬이 실제로 있던 곳이라 벽 안으로 들어가지 않는다
    const posA = { x: bodyA.GetPosition().x, y: bodyA.GetPosition().y, angle: bodyA.GetAngle() };
    const posB = { x: bodyB.GetPosition().x, y: bodyB.GetPosition().y, angle: bodyB.GetAngle() };
    const velA = { x: bodyA.GetLinearVelocity().x, y: bodyA.GetLinearVelocity().y };
    const velB = { x: bodyB.GetLinearVelocity().x, y: bodyB.GetLinearVelocity().y };

    bodyA.SetTransform(new this.Box2D.b2Vec2(posB.x, posB.y), posB.angle);
    bodyB.SetTransform(new this.Box2D.b2Vec2(posA.x, posA.y), posA.angle);
    bodyA.SetLinearVelocity(new this.Box2D.b2Vec2(velB.x, velB.y));
    bodyB.SetLinearVelocity(new this.Box2D.b2Vec2(velA.x, velA.y));
    bodyA.SetAwake(true);
    bodyB.SetAwake(true);
  }

  freeze(ids: number[], durationMs: number, immunityMs: number): void {
    this.freezeImmunity = immunityMs;
    ids.forEach((id) => {
      const body = this.marbleMap[id];
      if (!body) return;
      // 이미 얼어 있으면 연장하지 않고, 막 풀린 구슬은 면역 시간 동안 다시 얼지 않는다
      if (this.frozen.has(id) || (this.freezeImmuneUntil.get(id) ?? -Infinity) > this.simTime) return;
      this.frozen.set(id, durationMs);
      this.applyGravityScale(id, body);
      this.stopBody(body);
    });
  }

  antiGravity(id: number, durationMs: number, scale: number, maxUpSpeed: number): void {
    const body = this.marbleMap[id];
    if (!body) return;
    // 이미 떠 있으면 남은 시간이 긴 쪽으로 맞춘다
    const remaining = Math.max(this.floating.get(id)?.remaining ?? 0, durationMs);
    this.floating.set(id, { remaining, scale, maxUpSpeed });
    this.applyGravityScale(id, body);
    body.SetAwake(true);
  }

  magnet(id: number, targets: number[], range: number, power: number): void {
    const src = this.marbleMap[id];
    if (!src || range <= 0) return;
    const sx = src.GetPosition().x;
    const sy = src.GetPosition().y;

    targets.forEach((targetId) => {
      const body = this.marbleMap[targetId];
      if (!body || body === src) return;
      const dx = sx - body.GetPosition().x;
      const dy = sy - body.GetPosition().y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= range || dist < 1e-6) return;
      // 가까울수록 세다. (1 - 거리/범위)^2 로 줄어들고, 방향은 발동한 구슬 쪽
      const falloff = 1 - dist / range;
      const k = (falloff * falloff * power) / dist;
      body.ApplyLinearImpulseToCenter(new this.Box2D.b2Vec2(dx * k, dy * k), true);
    });
  }

  /**
   * 얼음과 반중력은 둘 다 중력 배율을 바꾸므로 여기서 한 번에 정한다.
   * 얼음이면 0, 떠 있으면 그 배율, 둘 다 아니면 원래대로 1
   */
  private applyGravityScale(id: number, body: Box2D.b2Body) {
    if (this.frozen.has(id)) {
      body.SetGravityScale(0);
    } else {
      body.SetGravityScale(this.floating.get(id)?.scale ?? 1);
    }
  }

  private stopBody(body: Box2D.b2Body) {
    body.SetLinearVelocity(new this.Box2D.b2Vec2(0, 0));
    body.SetAngularVelocity(0);
  }

  /** 얼음, 반중력의 남은 시간을 물리 시간만큼 줄이고, 끝난 구슬은 중력을 원래대로 되돌린다 */
  private updateTimedEffects(deltaSeconds: number) {
    if (this.frozen.size === 0 && this.floating.size === 0) return;
    const dt = deltaSeconds * 1000;
    const ended = new Set<number>();

    for (const [id, remaining] of this.frozen) {
      const body = this.marbleMap[id];
      if (!body) {
        this.frozen.delete(id);
        continue;
      }
      const left = remaining - dt;
      if (left <= 0) {
        this.frozen.delete(id);
        this.freezeImmuneUntil.set(id, this.simTime + this.freezeImmunity);
        ended.add(id);
      } else {
        this.frozen.set(id, left);
        // 다른 구슬에 밀려 생긴 속도도 매 스텝 지워서 제자리에 머물게 한다
        this.stopBody(body);
      }
    }

    for (const [id, state] of this.floating) {
      const body = this.marbleMap[id];
      if (!body) {
        this.floating.delete(id);
        continue;
      }
      state.remaining -= dt;
      if (state.remaining <= 0) {
        this.floating.delete(id);
        ended.add(id);
      } else if (!this.frozen.has(id)) {
        // 너무 빨리 떠오르지 않게 위쪽 속도를 제한한다
        const v = body.GetLinearVelocity();
        if (v.y < -state.maxUpSpeed) {
          body.SetLinearVelocity(new this.Box2D.b2Vec2(v.x, -state.maxUpSpeed));
        }
      }
    }

    ended.forEach((id) => {
      const body = this.marbleMap[id];
      if (!body) return;
      this.applyGravityScale(id, body);
      body.SetAwake(true);
    });
  }

  start(): void {
    for (const key in this.marbleMap) {
      const marble = this.marbleMap[key];
      marble.SetAwake(true);
      marble.SetEnabled(true);
    }
  }

  // contact 목록에는 AABB만 겹친 contact도 섞여 있고, 새 contact가 맨 앞에 붙으므로 전체를 순회해야 한다.
  private isTouchingAny(body: Box2D.b2Body): boolean {
    const { getPointer } = this.Box2D;
    for (let edge = body.GetContactList(); getPointer(edge) !== 0; edge = edge.next) {
      if (edge.contact.IsTouching()) return true;
    }
    return false;
  }

  step(deltaSeconds: number): void {
    this.deleteCandidates.forEach((body) => {
      this.world.DestroyBody(body);
    });
    this.deleteCandidates = [];

    this.simTime += deltaSeconds * 1000;
    this.updateTimedEffects(deltaSeconds);
    this.world.Step(deltaSeconds, 6, 2);

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      if (entity.life > 0) {
        if (this.isTouchingAny(entity.body)) {
          this.deleteCandidates.push(entity.body);
          this.entities.splice(i, 1);
        }
      }
    }
  }
}
