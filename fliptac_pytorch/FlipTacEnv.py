import numpy as np
import random

class FlipTacEnv:
    """
    FlipTacのゲーム環境クラス
    ポテンシャル法に基づく報酬シェーピングを導入したバージョン。
    """
    def __init__(self, size=7, discount_factor=0.99, shaping_factor=0.10):
        self.size = size
        self.marks = {1: 'X', -1: 'O'} # 1: AI, -1: Opponent
        self.gamma = discount_factor     # 割引率γ
        self.shaping_factor = shaping_factor # 報酬シェーピングの影響度を調整する係数
        self.reset()

    def reset(self):
        """ ゲームの状態を初期化する """
        self.board = np.zeros((self.size, self.size), dtype=int)
        self.last_move = {1: None, -1: None}
        self.current_player = 1 # AI (X) starts
        return self._get_state()

    def _get_state(self):
        """
        ニューラルネットワークへの入力となる状態を返す。
        Channel 0: 自分の石の位置
        Channel 1: 相手の石の位置
        Channel 2: 現在のプレイヤー（全面1 or -1）
        """
        state = np.zeros((3, self.size, self.size), dtype=np.float32)
        state[0, self.board == self.current_player] = 1.0
        state[1, self.board == -self.current_player] = 1.0
        state[2, :, :] = self.current_player
        return state

    def get_valid_moves(self, player):
        """ 指定されたプレイヤーの有効な手をすべてリストアップする """
        moves = []
        for r in range(self.size):
            for c in range(self.size):
                if self.is_valid_move(player, r, c):
                    moves.append((r, c))
        return moves

    def is_valid_move(self, player, row, col):
        """ 特定の手が有効かどうかを判定する """
        if self.board[row, col] != 0:
            return False
        last_pos = self.last_move[player]
        if last_pos is None:
            return row == 0 or row == self.size - 1 or col == 0 or col == self.size - 1
        lr, lc = last_pos
        if abs(lr - row) <= 1 and abs(lc - col) <= 1:
            return True
        if lr == row and abs(lc - col) == 2:
            jump_over_pos = self.board[row, (lc + col) // 2]
            return jump_over_pos != 0 and jump_over_pos != player
        elif lc == col and abs(lr - row) == 2:
            jump_over_pos = self.board[(lr + row) // 2, col]
            return jump_over_pos != 0 and jump_over_pos != player
        return False

    def _calculate_potential(self, player):
        """
        状態の価値（ポテンシャルΦ）を計算する関数。
        ここでは「行動の自由度（Mobility）」をポテンシャルとして定義する。
        Φ = (自分の有効手数) - (相手の有効手数)
        """
        my_moves = len(self.get_valid_moves(player))
        opponent_moves = len(self.get_valid_moves(-player))
        return my_moves - (1.5 * opponent_moves)

    def step(self, action):
        """
        行動を実行し、次の状態、報酬、ゲーム終了フラグを返す
        """
        row, col = action
        player = self.current_player

        # --- ポテンシャル法のための計算(1/2): 行動前のポテンシャルを計算 ---
        potential_before = self._calculate_potential(player)
        # --------------------------------------------------------------------

        if not self.is_valid_move(player, row, col):
            return self._get_state(), -20.0, True, {} # 無効手へのペナルティ

        self.board[row, col] = player
        self.last_move[player] = (row, col)
        
        # 相手のターンに切り替え
        self.current_player *= -1
        opponent = self.current_player

        # --- ポテンシャル法のための計算(2/2): 行動後のポテンシャルを計算 ---
        # 報酬は行動したプレイヤー(player)視点で計算するため、引数に注意
        potential_after = self._calculate_potential(player)
        # --------------------------------------------------------------------

        # --- 報酬の計算 ---
        # 1. 最終結果に基づく基本報酬
        opponent_valid_moves = self.get_valid_moves(opponent)
        my_valid_moves = self.get_valid_moves(player)
        
        done = False
        reward = 0.0

        if not opponent_valid_moves:
            done = True
            reward = 5.0  # 勝利報酬
        elif not my_valid_moves:
            done = True
            reward = -2.0 # 敗北報酬

        # 2. ポテンシャル法に基づく追加報酬（報酬シェーピング）
        # F = γ * Φ(s') - Φ(s)
        # gamma=0.99, shaping_factor=0.10
        shaping_reward = (self.gamma * potential_after) - potential_before
        
        # 影響度を調整して最終的な報酬に加える
        reward += self.shaping_factor * shaping_reward
        
        # 3. 時間経過による小さなペナルティ
        reward -= 0.01

        # 4. 角のペナルティ
        corners = [(0, 0), (0, self.size - 1), (self.size - 1, 0), (self.size - 1, self.size - 1)]
        if action in corners:
            reward -= 0.20

        # 5. 戦術的ボーナス: 相手の最後の手に近い位置に打つと小さなボーナス
        opponent_last_move = self.last_move[opponent]
        if opponent_last_move:
            opp_r, opp_c = opponent_last_move
            # 距離を計算
            dist = max(abs(row - opp_r), abs(col - opp_c))
            if dist >= 5:
                reward -= 0.10
            elif dist <= 3:
                reward += 0.05



        return self._get_state(), reward, done, {}

