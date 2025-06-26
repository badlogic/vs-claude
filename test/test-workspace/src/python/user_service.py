from typing import List, Optional, Dict
from dataclasses import dataclass
import asyncio


@dataclass
class User:
    id: int
    name: str
    email: str


class UserService:
    """Service class for managing users"""
    
    def __init__(self):
        self._users: List[User] = []
    
    async def get_user(self, user_id: int) -> Optional[User]:
        """Get a user by ID"""
        for user in self._users:
            if user.id == user_id:
                return user
        return None
    
    async def get_all_users(self) -> List[User]:
        """Get all users"""
        return self._users.copy()
    
    async def create_user(self, user: User) -> User:
        """Create a new user"""
        self._users.append(user)
        return user
    
    async def update_user(self, user_id: int, updates: Dict[str, str]) -> Optional[User]:
        """Update an existing user"""
        for i, user in enumerate(self._users):
            if user.id == user_id:
                if 'name' in updates:
                    user.name = updates['name']
                if 'email' in updates:
                    user.email = updates['email']
                return user
        return None
    
    async def delete_user(self, user_id: int) -> bool:
        """Delete a user by ID"""
        for i, user in enumerate(self._users):
            if user.id == user_id:
                del self._users[i]
                return True
        return False


class UserController:
    """Controller for handling user-related requests"""
    
    def __init__(self, user_service: UserService):
        self._user_service = user_service
    
    async def handle_get_user(self, user_id: int) -> Optional[User]:
        """Handle get user request"""
        return await self._user_service.get_user(user_id)
    
    async def handle_get_all_users(self) -> List[User]:
        """Handle get all users request"""
        return await self._user_service.get_all_users()
    
    async def handle_create_user(self, user_data: Dict[str, any]) -> User:
        """Handle create user request"""
        user = User(
            id=user_data['id'],
            name=user_data['name'],
            email=user_data['email']
        )
        return await self._user_service.create_user(user)