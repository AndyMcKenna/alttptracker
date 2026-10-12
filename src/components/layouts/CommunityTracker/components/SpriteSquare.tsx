import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../../../../store/store";
import ChestCounter from "../../../tracker/ChestCounter";
import SpriteDisplay from "../../../tracker/SpriteDisplay";
import TrackerItem from "../../../tracker/TrackerItem";
import BigKeyTracker from "../../../tracker/BigKeyTracker";
import SmallKeyTracker from "../../../tracker/SmallKeyTracker";
import AutotrackingIcon from "@/components/tracker/AutotrackingIcon";
import { setModalOpen } from "@/store/trackerSlice";
import { Settings } from "lucide-react";
import GoalSelector from "@/components/tracker/GoalSelector";

function SpriteSquare() {
  const dispatch = useDispatch();
  const wildBigKeys = useSelector((state: RootState) => state.settings.wildBigKeys);
  const wildSmallKeys = useSelector((state: RootState) => state.settings.wildSmallKeys);
  const keyDrop = useSelector((state: RootState) => state.settings.enemyDrop) !== "none";
  const autotracking = useSelector((state: RootState) => state.settings.autotracking);
  const spriteName = useSelector((state: RootState) => state.settings.spriteName);
  const alwaysShowSmallKeys = useSelector((state: RootState) => state.settings.alwaysShowSmallKeys);
  const alwaysShowBigKeys = useSelector((state: RootState) => state.settings.alwaysShowBigKeys);
  const doors = false;
  const doorShuffle = useSelector((state: RootState) => state.settings.doors) !== "vanilla";

  // Same rules as DungeonSquare
  const showSmallKeys = alwaysShowSmallKeys || wildSmallKeys === "wild";
  const showBigKeys = alwaysShowBigKeys || wildBigKeys;
  // HC's big key is an enemy drop; CT only has a big key with door shuffle
  const showHCBigKey = showBigKeys || keyDrop;
  const showCTBigKey = doorShuffle && (showBigKeys || keyDrop);

  return (
    <div className="relative w-full h-full">
      <div className="h-24 w-24">
        <SpriteDisplay spriteName={spriteName} />
      </div>
      <div className="h-10 w-10 absolute top-14 right-8">
        <TrackerItem itemName="moonpearl" />
      </div>
      <div className="h-12 w-12 absolute top-0 right-8">
        <TrackerItem itemName="sword" />
      </div>
      <div className="h-10 w-10 absolute bottom-8 right-22">
        <TrackerItem itemName="shield" />
      </div>
      <div className="h-4 w-4 absolute top-11 right-9">
        <TrackerItem itemName="heartpiece" skipFirstImgOnCollect />
      </div>
      <div className="flex items-center h-6 w-6 absolute top-0 left-0.5">
        <GoalSelector type="gtOpen" />
      </div>
      <div className="flex items-center h-6 w-6 absolute top-6 left-0.5">
        <GoalSelector type="goal" />
      </div>
      {/* Mystery Flags */}
      <div className="flex items-center h-6 w-6 absolute top-12 left-0.5">
        <Settings size={16} className="cursor-pointer text-gray-300" onClick={() => dispatch(setModalOpen("mystery"))} />
      </div>
      {/* Autotracking Icon */}
      {autotracking && (
        <div className="h-4 w-4 absolute top-0.5 right-18.5">
          <AutotrackingIcon size={16} />
        </div>
      )}
      {/* HC */}
      {(showSmallKeys || showHCBigKey) && (
        <div>
          <div className="h-4 w-4 absolute top-4 right-4">
            {showSmallKeys && <SmallKeyTracker dungeon="hc" size="1x1" />}
            {showHCBigKey && (
              <div className={`h-1 w-1 absolute ${showSmallKeys ? "top-4 right-3" : "top-0 right-3"} rounded-full bg-black`}>
                <BigKeyTracker dungeon="hc" size={showSmallKeys ? "1x1" : "1x2"} />
              </div>
            )}
          </div>
          <div className="h-4 w-4 absolute top-0.5 right-1 text-white font-bold font-arialblack text-2xs">HC</div>
        </div>
      )}
      {/* CT */}
      {(showSmallKeys || showCTBigKey) && (
        <div>
          <div className="h-4 w-4 absolute top-16 right-4">
            {showSmallKeys && <SmallKeyTracker dungeon="ct" size="1x1" />}
            {showCTBigKey && (
              <div className={`h-1 w-1 absolute ${showSmallKeys ? "top-4 right-3" : "top-0 right-3"} rounded-full bg-black`}>
                <BigKeyTracker dungeon="ct" size={showSmallKeys ? "1x1" : "1x2"} />
              </div>
            )}
          </div>
          <div className="h-4 w-4 absolute top-12.5 right-1 text-white font-bold font-arialblack text-2xs">CT</div>
        </div>
      )}
      {/* GT */}
      <div className="flex flex-row h-8 w-32">
        <div className="flex flex-row h-8 w-8">
          <ChestCounter dungeon="gt" small />
        </div>
        {showBigKeys && <BigKeyTracker dungeon="gt" />}
        {showSmallKeys && <SmallKeyTracker dungeon="gt" size={doors ? "1x1" : "1x2"} />}
      </div>
    </div>
  );
}

export default SpriteSquare;
