"""Conversation inbox routes (all threads for the current user)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.catalog.models import Listing
from app.domains.identity.dependencies import ActorContext, require_actor
from app.domains.identity.models import UserProfile
from app.domains.messaging.schemas import ConversationSummaryResponse
from app.domains.messaging.service import MessagingService

router = APIRouter(tags=["messaging"])


@router.get("/conversations")
def list_conversations(
    actor: ActorContext = Depends(require_actor),
    db: Session = Depends(get_db),
) -> list[ConversationSummaryResponse]:
    service = MessagingService(db)
    conversations = service.list_for_user(actor.user.id)
    last_messages = service.last_messages([conversation.id for conversation in conversations])

    listing_ids = [
        conversation.listing_id
        for conversation in conversations
        if conversation.listing_id
    ]
    listings = (
        {
            listing.id: listing
            for listing in db.scalars(select(Listing).where(Listing.id.in_(listing_ids)))
        }
        if listing_ids
        else {}
    )

    other_user_ids = [
        conversation.owner_user_id
        if conversation.renter_user_id == actor.user.id
        else conversation.renter_user_id
        for conversation in conversations
    ]
    profiles = (
        {
            profile.user_id: profile
            for profile in db.scalars(
                select(UserProfile).where(UserProfile.user_id.in_(other_user_ids))
            )
        }
        if other_user_ids
        else {}
    )

    summaries = []
    for conversation in conversations:
        other_user_id = (
            conversation.owner_user_id
            if conversation.renter_user_id == actor.user.id
            else conversation.renter_user_id
        )
        listing = listings.get(conversation.listing_id) if conversation.listing_id else None
        last_message = last_messages.get(conversation.id)
        profile = profiles.get(other_user_id)
        summaries.append(
            ConversationSummaryResponse(
                id=conversation.id,
                listing_id=conversation.listing_id,
                listing_title=listing.title if listing else None,
                other_user_id=other_user_id,
                other_display_name=profile.display_name if profile else "4x4 member",
                last_message_body=last_message.body if last_message else None,
                last_message_at=(
                    last_message.created_at if last_message else conversation.created_at
                ),
                last_message_is_mine=(
                    last_message.sender_user_id == actor.user.id if last_message else False
                ),
            )
        )
    summaries.sort(key=lambda item: item.last_message_at, reverse=True)
    return summaries
