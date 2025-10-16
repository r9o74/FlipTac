import numpy as np
import random

class FlipTacEnv:
    """
    FlipTacのゲーム環境クラス
    自己閉塞ペナルティを追加したバージョン。
    """
    def __init__(self, size=7, discount_factor=0.99, shaping_factor=0.1):
        self.size = size
        self.marks = {1: 'X', -1: 'O'}
        self.gamma = discount_factor
        self.shaping_factor = shaping_factor
        self.reset()

    def reset(self):
        self.board = np.zeros((self.size, self.size), dtype=int)
        self.last_move = {1: None, -1: None}
        self.current_player = 1
        return self._get_state()
    def _get_state(self):
        state = np.zeros((3, self.size, self.size), dtype=np.float32)
        state[0, self.board == self.current_player] = 1.0
        state[1, self.board == -self.current_player] = 1.0
        state[2, :, :] = self.current_player
        return state
    def get_valid_moves(self, player):
        moves = []
        for r in range(self.size):
            for c in range(self.size):
                if self.is_valid_move(player, r, c):
                    moves.append((r, c))
        return moves
    def is_valid_move(self, player, row, col):
        if self.board[row, col] != 0: return False
        last_pos = self.last_move[player]
        if last_pos is None: return row == 0 or row == self.size - 1 or col == 0 or col == self.size - 1
        lr, lc = last_pos
        if abs(lr - row) <= 1 and abs(lc - col) <= 1: return True
        if lr == row and abs(lc - col) == 2:
            jump_over_pos = self.board[row, (lc + col) // 2]
            return jump_over_pos != 0 and jump_over_pos != player
        elif lc == col and abs(lr - row) == 2:
            jump_over_pos = self.board[(lr + row) // 2, col]
            return jump_over_pos != 0 and jump_over_pos != player
        return False
    def _calculate_potential(self, player):
        my_moves = len(self.get_valid_moves(player))
        opponent_moves = len(self.get_valid_moves(-player))
        return my_moves - (opponent_moves * 1.5)
    
    def step(self, action):
        row, col = action
        player = self.current_player

        potential_before = self._calculate_potential(player)

        if not self.is_valid_move(player, row, col):
            return self._get_state(), -20.0, True, {}

        # ---
        # 盤面を仮に進めて、行動後の有効手数を確認する
        temp_board = np.copy(self.board)
        temp_last_move = self.last_move.copy()
        temp_board[row, col] = player
        temp_last_move[player] = (row, col)
        
        # is_valid_moveのチェックのため、一時的にselfを書き換えるハック
        original_board, original_last_move = self.board, self.last_move
        self.board, self.last_move = temp_board, temp_last_move
        my_next_moves = self.get_valid_moves(player)
        self.board, self.last_move = original_board, original_last_move # 元に戻す
        # ---
        
        self.board[row, col] = player
        self.last_move[player] = (row, col)
        
        self.current_player *= -1
        opponent = self.current_player

        potential_after = self._calculate_potential(player)

        reward = 0.0
        
        # ▼▼▼ 自己閉塞ペナルティの導入 ▼▼▼
        # 行動後の有効手数が2手以下になったら、強いペナルティを与える
        if len(my_next_moves) <= 2:
            reward -= 0.5
        # ▲▲▲ ここまで ▲▲▲

        corners = [(0, 0), (0, self.size - 1), (self.size - 1, 0), (self.size - 1, self.size - 1)]
        if action in corners: reward -= 0.25
        
        opponent_last_move = self.last_move[opponent]
        if opponent_last_move:
            opp_r, opp_c = opponent_last_move
            dist = abs(row - opp_r) + abs(col - opp_c)
            if dist <= 4:
                reward += (1 / (dist + 3)) * 0.2
        
        opponent_valid_moves = self.get_valid_moves(opponent)
        
        done = False
        base_reward = 0.0
        if not opponent_valid_moves:
            done, base_reward = True, 1.5
        # 自分の次の手がなくなっても敗北
        elif not my_next_moves:
            done, base_reward = True, -2.0
        
        reward += base_reward
        
        shaping_reward = (self.gamma * potential_after) - potential_before
        reward += self.shaping_factor * shaping_reward
        
        reward -= 0.01

        return self._get_state(), reward, done, {}

