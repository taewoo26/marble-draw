import Box2DFactory from 'box2d-wasm';
import type { StageDef } from './data/maps';
import type { IPhysics } from './IPhysics';
import type { MapEntity, MapEntityState } from './types/MapEntity.type';

/** 구슬 기본 물리 반지름 */
const MARBLE_RADIUS = 0.25;

/** 크기 스킬 상태 */
type ResizeState = {
  /** 목표 배율. 유지 시간이 끝나면 1 로 바뀐다 */
  target: number;
  /** 목표 배율을 유지할 남은 시간(ms, 물리 시간). 0 이하면 원래 크기로 돌아가는 중 */
  remaining: number;
  /** 지금 배율에서 목표 배율까지 걸리는 시간(ms) */
  rampMs: number;
  /** 지금 화면·물리에 쓰는 배율. rampMs 동안 부드럽게 바뀐다 */
  current: number;
  /** 지금 물리 원에 적용된 배율. current 와 step 이상 차이 나면 원을 다시 만든다 */
  applied: number;
  step: number;
  /** 이번 변화가 시작될 때의 배율. 변화 속도 계산에 쓴다 */
  from: number;
};

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
  /** 거대화·축소 중인 구슬 id → 크기 상태 */
  private resizing = new Map<number, ResizeState>();
  /** 구슬 id → 밀도. 원을 다시 만들 때 처음 밀도를 그대로 쓴다 */
  private marbleDensity = new Map<number, number>();

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
    this.resizing.clear();
    this.marbleDensity.clear();
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
    circleShape.set_m_radius(MARBLE_RADIUS);

    const bodyDef = new this.Box2D.b2BodyDef();
    bodyDef.set_type(this.Box2D.b2_dynamicBody);
    bodyDef.set_position(new this.Box2D.b2Vec2(x, y));

    const body = this.world.CreateBody(bodyDef);
    const density = 1 + Math.random();
    body.CreateFixture(circleShape, density);
    this.marbleDensity.set(id, density);
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
      this.resizing.delete(id);
      this.marbleDensity.delete(id);
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

  resize(id: number, scale: number, durationMs: number, rampMs: number, step: number): void {
    const body = this.marbleMap[id];
    if (!body) return;
    const state = this.resizing.get(id);
    if (state && state.target === scale) {
      // 같은 스킬이 또 나오면 더 커지거나 작아지지 않고 시간만 연장한다
      state.remaining = Math.max(state.remaining, durationMs);
      return;
    }
    // 처음이거나 다른 배율이 진행 중이면 지금 크기에서 새 배율로 바꾼다 (나중 스킬이 앞 스킬을 대체)
    const current = state?.current ?? 1;
    this.resizing.set(id, {
      target: scale,
      remaining: durationMs,
      rampMs,
      current,
      applied: state?.applied ?? 1,
      step,
      from: current,
    });
  }

  getMarbleScale(id: number): number {
    return this.resizing.get(id)?.current ?? 1;
  }

  /** 구슬의 원형 fixture 를 지우고 scale 배 반지름으로 다시 만든다. 밀도는 처음 값 그대로 */
  private applyMarbleScale(id: number, body: Box2D.b2Body, scale: number) {
    const { getPointer } = this.Box2D;
    const fixture = body.GetFixtureList();
    if (getPointer(fixture) !== 0) body.DestroyFixture(fixture);
    const shape = new this.Box2D.b2CircleShape();
    shape.set_m_radius(MARBLE_RADIUS * scale);
    body.CreateFixture(shape, this.marbleDensity.get(id) ?? 1);
    body.SetAwake(true);
  }

  /** 크기 배율을 목표 쪽으로 옮기고, step 이상 바뀌었거나 목표에 닿았으면 물리 원을 다시 만든다 */
  private updateResizing(dt: number) {
    for (const [id, state] of this.resizing) {
      const body = this.marbleMap[id];
      if (!body) {
        this.resizing.delete(id);
        continue;
      }
      // 유지 시간이 끝나면 원래 크기로 돌아간다
      if (state.remaining > 0) {
        state.remaining -= dt;
        if (state.remaining <= 0 && state.target !== 1) {
          state.from = state.current;
          state.target = 1;
        }
      }
      if (state.current !== state.target) {
        const speed = Math.abs(state.target - state.from) / Math.max(1, state.rampMs);
        const delta = speed * dt;
        state.current =
          state.current < state.target
            ? Math.min(state.target, state.current + delta)
            : Math.max(state.target, state.current - delta);
      }
      const reached = state.current === state.target;
      if (
        state.applied !== state.current &&
        (reached || Math.abs(state.current - state.applied) >= state.step - 1e-9)
      ) {
        this.applyMarbleScale(id, body, state.current);
        state.applied = state.current;
      }
      if (reached && state.target === 1 && state.remaining <= 0) {
        this.resizing.delete(id);
      }
    }
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
    if (this.resizing.size > 0) this.updateResizing(deltaSeconds * 1000);
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
