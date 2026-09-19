import React from 'react'
import { Mascot } from 'page-mascot'

export default function App() {
  return (
    <div className="page">
      <header className="hero">
        <div className="badge">page-mascot · npm 包演示</div>
        <h1>会盯着你的<span className="grad">鼠标</span>看的网页吉祥物</h1>
        <p>它像这样工作：光标靠近，脑袋跟着你转；戳它一下，它会眨眼。下面这只狐狸和水獭就是这么活的。</p>
        <div className="tips">
          <span>👉 移动鼠标 · 看它转头</span>
          <span>👆 点击它 · 看它眨眼</span>
        </div>
      </header>

      <section className="cards">
        <div className="card">
          <h3>实现方式</h3>
          <p>每个角色 = 两张 3×3 雪碧图：一张 9 个朝向，一张 9 个表情。组件的指针角度选朝向，点击触发反应。</p>
          <code>&lt;Mascot directions="/mascots/fox-directions.webp" reactions="/mascots/fox-reactions.webp" /&gt;</code>
        </div>
        <div className="card">
          <h3>特性</h3>
          <ul>
            <li>72 星开源 · MIT 协议</li>
            <li>React 组件，两个 props 接入</li>
            <li>无触摸设备自动关闭追踪</li>
            <li>尊重 prefers-reduced-motion</li>
          </ul>
        </div>
      </section>

      <footer className="foot">page-mascot by nilbuild · demo by Hermes</footer>

      {/* 两只吉祥物固定在页面两侧，观察光标 */}
      <div className="mascot-left">
        <Mascot directions="/mascots/fox-directions.webp" reactions="/mascots/fox-reactions.webp" size={150} />
        <div className="mascot-tag">狐狸</div>
      </div>
      <div className="mascot-right">
        <Mascot directions="/mascots/otter-directions.webp" reactions="/mascots/otter-reactions.webp" size={150} />
        <div className="mascot-tag">水獭</div>
      </div>
    </div>
  )
}