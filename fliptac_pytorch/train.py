import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
import numpy as np
import random
import math
import os
import re
from collections import namedtuple, deque
from itertools import count
from tqdm import tqdm

# ローカルファイルからクラスをインポート
from FlipTacEnv import FlipTacEnv
from model import DQN

# ===============================================================
# 設定
# ===============================================================
BATCH_SIZE = 128
GAMMA = 0.99
EPS_START = 0.9
EPS_END = 0.05
EPS_DECAY = 20000
TAU = 0.005
LR = 1e-4
BOARD_SIZE = 7
NUM_EPISODES = 30000 # 学習回数

# ===============================================================
# Replay Memory
# ===============================================================
Transition = namedtuple('Transition', ('state', 'action', 'next_state', 'reward'))
class ReplayMemory(object):
    def __init__(self, capacity):
        self.memory = deque([], maxlen=capacity)
    def push(self, *args):
        self.memory.append(Transition(*args))
    def sample(self, batch_size):
        return random.sample(self.memory, batch_size)
    def __len__(self):
        return len(self.memory)

# ===============================================================
# 初期化 & チェックポイントからの再開
# ===============================================================
env = FlipTacEnv(size=BOARD_SIZE)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

policy_net = DQN(BOARD_SIZE, BOARD_SIZE).to(device)
target_net = DQN(BOARD_SIZE, BOARD_SIZE).to(device)
optimizer = optim.AdamW(policy_net.parameters(), lr=LR, amsgrad=True)
memory = ReplayMemory(10000)
steps_done = 0
start_episode = 0

checkpoint_dir = '.'
files = os.listdir(checkpoint_dir)
checkpoints = [f for f in files if f.startswith('fliptac_dqn_episode_') and f.endswith('.pth')]

if checkpoints:
    latest_episode = -1
    latest_checkpoint_file = None
    for ckpt in checkpoints:
        match = re.search(r'episode_(\d+)\.pth', ckpt)
        if match:
            episode_num = int(match.group(1))
            if episode_num > latest_episode:
                latest_episode, latest_checkpoint_file = episode_num, ckpt
    
    if latest_checkpoint_file:
        print(f"Resuming training from checkpoint: {latest_checkpoint_file}")
        
        # ▼▼▼ ここが重要な修正箇所です ▼▼▼
        try:
            # 新しい形式（辞書）での読み込みを試みる
            checkpoint = torch.load(latest_checkpoint_file)
            if isinstance(checkpoint, dict):
                policy_net.load_state_dict(checkpoint['policy_net_state_dict'])
                optimizer.load_state_dict(checkpoint.get('optimizer_state_dict', optimizer.state_dict()))
                steps_done = checkpoint.get('steps_done', 0)
            else:
                # 辞書でなければ古い形式と判断
                policy_net.load_state_dict(checkpoint)
                print("Warning: Loaded an old checkpoint format. Optimizer state and steps_done are not restored.")
        except Exception as e:
            # weights_only=False/True の問題を吸収するためのフォールバック
            print(f"Could not load checkpoint with default method due to {e}. Trying with weights_only=True.")
            checkpoint = torch.load(latest_checkpoint_file, weights_only=True)
            policy_net.load_state_dict(checkpoint)
            print("Warning: Loaded an old checkpoint format. Optimizer state and steps_done are not restored.")
        # ▲▲▲ 修正ここまで ▲▲▲
        
        start_episode = latest_episode
        print(f"Resumed from episode {start_episode}.")

target_net.load_state_dict(policy_net.state_dict())
target_net.eval()

# ===============================================================
# 関数定義 (select_action, optimize_model)
# ===============================================================
def select_action(state):
    global steps_done
    sample = random.random()
    eps_threshold = EPS_END + (EPS_START - EPS_END) * math.exp(-1. * steps_done / EPS_DECAY)
    steps_done += 1
    if sample > eps_threshold:
        with torch.no_grad():
            q_values = policy_net(state)
            valid_moves = env.get_valid_moves(env.current_player)
            if not valid_moves: return None
            mask = torch.full((BOARD_SIZE * BOARD_SIZE,), -float('inf'), device=device)
            for r, c in valid_moves:
                mask[r * BOARD_SIZE + c] = 0.0
            action_q_values = q_values.view(-1) + mask
            action_idx = action_q_values.argmax().item()
            return (action_idx // BOARD_SIZE, action_idx % BOARD_SIZE)
    else:
        valid_moves = env.get_valid_moves(env.current_player)
        return random.choice(valid_moves) if valid_moves else None

def optimize_model():
    if len(memory) < BATCH_SIZE: return
    transitions = memory.sample(BATCH_SIZE)
    batch = Transition(*zip(*transitions))
    non_final_mask = torch.tensor(tuple(map(lambda s: s is not None, batch.next_state)), device=device, dtype=torch.bool)
    non_final_next_states = torch.cat([s for s in batch.next_state if s is not None])
    state_batch = torch.cat(batch.state)
    action_batch = torch.tensor([a[0] * BOARD_SIZE + a[1] for a in batch.action], device=device).unsqueeze(1)
    reward_batch = torch.cat(batch.reward)
    state_action_values = policy_net(state_batch).gather(1, action_batch)
    next_state_values = torch.zeros(BATCH_SIZE, device=device)
    with torch.no_grad():
        next_state_values[non_final_mask] = target_net(non_final_next_states).max(1)[0]
    expected_state_action_values = (next_state_values * GAMMA) + reward_batch
    criterion = nn.SmoothL1Loss()
    loss = criterion(state_action_values, expected_state_action_values.unsqueeze(1))
    optimizer.zero_grad()
    loss.backward()
    torch.nn.utils.clip_grad_value_(policy_net.parameters(), 100)
    optimizer.step()

# ===============================================================
# 学習ループ
# ===============================================================
if __name__ == '__main__':
    for i_episode in tqdm(range(start_episode, NUM_EPISODES), desc="Training Progress", initial=start_episode, total=NUM_EPISODES):
        state = env.reset()
        state = torch.tensor(state, dtype=torch.float32, device=device).unsqueeze(0)
        for t in count():
            action = select_action(state)
            if action is None: break
            observation, reward, done, _ = env.step(action)
            reward = torch.tensor([reward], device=device)
            next_state = None if done else torch.tensor(observation, dtype=torch.float32, device=device).unsqueeze(0)
            memory.push(state, action, next_state, reward)
            state = next_state
            optimize_model()
            target_net_state_dict = target_net.state_dict()
            policy_net_state_dict = policy_net.state_dict()
            for key in policy_net_state_dict:
                target_net_state_dict[key] = policy_net_state_dict[key]*TAU + target_net_state_dict[key]*(1-TAU)
            target_net.load_state_dict(target_net_state_dict)
            if done: break
        
        if (i_episode + 1) % 100 == 0:
            torch.save({
                'policy_net_state_dict': policy_net.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'steps_done': steps_done,
            }, f"fliptac_dqn_episode_{i_episode+1}.pth")

    print('Complete')
    torch.save({
        'policy_net_state_dict': policy_net.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'steps_done': steps_done,
    }, "fliptac_dqn_final.pth")

