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

  freeze(ids: number[], durationMs: number): void {
    ids.forEach((id) => {
      const body = this.marbleMap[id];
      if (!body) return;
      // 이미 얼어 있으면 남은 시간이 긴 쪽으로 맞춘다
      this.frozen.set(id, Math.max(this.frozen.get(id) ?? 0, durationMs));
      body.SetGravityScale(0);
      this.stopBody(body);
    });
  }

  private stopBody(body: Box2D.b2Body) {
    body.SetLinearVelocity(new this.Box2D.b2Vec2(0, 0));
    body.SetAngularVelocity(0);
  }

  /** 얼음 남은 시간을 물리 시간만큼 줄이고, 끝난 구슬은 원래대로 되돌린다 */
  private updateFrozen(deltaSeconds: number) {
    if (this.frozen.size === 0) return;
    for (const [id, remaining] of this.frozen) {
      const body = this.marbleMap[id];
      if (!body) {
        this.frozen.delete(id);
        continue;
      }
      const left = remaining - deltaSeconds * 1000;
      if (left <= 0) {
        this.frozen.delete(id);
        body.SetGravityScale(1);
        body.SetAwake(true);
      } else {
        this.frozen.set(id, left);
        // 다른 구슬에 밀려 생긴 속도도 매 스텝 지워서 제자리에 머물게 한다
        this.stopBody(body);
      }
    }
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

    this.updateFrozen(deltaSeconds);
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
